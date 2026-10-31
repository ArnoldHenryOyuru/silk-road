"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server"; // match your existing helper
import { createAdminClient } from "@/lib/supabase/admin";
import { userRef } from "@/lib/deletion-ref";
import { sendDeletionConfirmation } from "@/lib/email/deletion-confirmation";

/* Matches your schema: account status lives on public.users (id = auth user id). */
const PHOTO_BUCKET = "profile-photos"; // private bucket (matches your layout.tsx)
// CONFIRM in Supabase -> Storage: which bucket holds verification selfies
// (profiles.verification_selfie_path)? If it isn't "profile-photos", change
// this, or the selfie would be left behind in storage after a deletion.
const SELFIE_BUCKET = "profile-photos";
const SELF_SERVICE_STATUSES = ["active", "deactivated"]; // who may self-delete
const VERIFIED_METHOD = "system:settings-action";

export type ActionState = { error?: string };

async function requireUser() {
  const supabase = await createClient();
  // getUser() re-validates the token with Supabase; getSession() does not.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return { supabase, user };
}

/* ------------------------------------------------------------------ */
/* Deactivate (free, reversible)                                       */
/* ------------------------------------------------------------------ */
export async function deactivateAccount(
  _prev: ActionState,
  _formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const admin = createAdminClient();

  // Service role, and only if currently 'active', so a suspended or banned
  // user can never use this action to change their own status.
  const { data, error } = await admin
    .from("users")
    .update({ status: "deactivated" })
    .eq("id", user.id)
    .eq("status", "active")
    .select("id");

  if (error) {
    return { error: "We couldn't deactivate your account. Try again in a moment." };
  }
  if (!data || data.length === 0) {
    return {
      error: "Only active accounts can be deactivated. Contact support if this looks wrong.",
    };
  }

  // Audit log (best effort: the deactivation itself already succeeded).
  if (user.email) {
    const { error: logError } = await admin.from("deletion_requests").insert({
      user_id: user.id,
      user_ref: userRef(user.email),
      request_type: "deactivation",
      completed_at: new Date().toISOString(),
      verified_method: VERIFIED_METHOD,
    });
    if (logError) console.error("deletion_requests insert failed (deactivation)");
  }

  await supabase.auth.signOut();
  redirect("/sign-in?deactivated=1");
}

/* ------------------------------------------------------------------ */
/* Delete permanently (free)                                           */
/* ------------------------------------------------------------------ */
export async function deleteAccount(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const confirmation = String(formData.get("confirmation") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (confirmation !== "DELETE") {
    return { error: "Type DELETE in capital letters to confirm." };
  }
  if (!password) {
    return { error: "Enter your password to confirm." };
  }
  if (!user.email) {
    return { error: "Your account has no email address on file. Contact support." };
  }
  const email = user.email;

  // Re-authenticate: a stolen or left-open session shouldn't be able to
  // destroy the account.
  const { error: passwordError } = await supabase.auth.signInWithPassword({ email, password });
  if (passwordError) {
    return { error: "That password isn't correct." };
  }

  const admin = createAdminClient();

  const { data: account } = await admin
    .from("users")
    .select("status, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!account) {
    return { error: "We couldn't find your account. Contact support." };
  }
  // Admin ids are referenced by reviewed_by columns elsewhere, so deleting an
  // admin here would fail midway. Remove admin rights first, by hand.
  if (account.is_admin) {
    return { error: "Admin accounts can't be deleted from here." };
  }
  // Suspended/banned users can't self-delete (a ban could be escaped by
  // deleting and re-registering). deletion_pending/deleted mean it's underway.
  if (!SELF_SERVICE_STATUSES.includes(account.status)) {
    return {
      error: "This account can't be deleted right now. Contact support.",
    };
  }
  const previousStatus: string = account.status;

  // 1. Audit row FIRST. No record, no irreversible purge. A full_deletion row
  //    with completed_at = null means a purge that didn't finish.
  const { data: request, error: requestError } = await admin
    .from("deletion_requests")
    .insert({
      user_id: user.id,
      user_ref: userRef(email),
      request_type: "full_deletion",
    })
    .select("id")
    .single();

  if (requestError || !request) {
    return { error: "We couldn't start the deletion, so nothing was deleted. Try again." };
  }

  // 2. Block sign-in while the purge runs (spec: deletion_pending).
  const { error: pendingError } = await admin
    .from("users")
    .update({ status: "deletion_pending" })
    .eq("id", user.id)
    .eq("status", previousStatus);
  if (pendingError) {
    return { error: "We couldn't start the deletion, so nothing was deleted. Try again." };
  }

  const abort = async (message: string): Promise<ActionState> => {
    await admin.from("users").update({ status: previousStatus }).eq("id", user.id);
    return { error: message };
  };

  // 3. Collect every storage path BEFORE the rows that hold them are deleted.
  const { data: profile } = await admin
    .from("profiles")
    .select("id, verification_selfie_path")
    .eq("user_id", user.id)
    .maybeSingle();

  const photoPaths = new Set<string>();
  if (profile) {
    const { data: photos } = await admin
      .from("profile_photos")
      .select("image_url")
      .eq("profile_id", profile.id);
    // Assumes image_url stores the storage path. The folder listing below
    // catches anything stored as <user_id>/<file> if it holds a full URL.
    for (const p of photos ?? []) if (p.image_url) photoPaths.add(p.image_url);
  }
  const { data: folder } = await admin.storage
    .from(PHOTO_BUCKET)
    .list(user.id, { limit: 1000 });
  for (const f of folder ?? []) photoPaths.add(`${user.id}/${f.name}`);

  // 4. Storage first: database cascades never remove files, and once the rows
  //    are gone we'd lose the paths. Missing files are not an error.
  if (photoPaths.size > 0) {
    const { error } = await admin.storage.from(PHOTO_BUCKET).remove([...photoPaths]);
    if (error) return abort("We couldn't remove your photos, so nothing was deleted. Try again.");
  }
  if (profile?.verification_selfie_path) {
    const { error } = await admin.storage
      .from(SELFIE_BUCKET)
      .remove([profile.verification_selfie_path]);
    if (error) return abort("We couldn't remove your photos, so nothing was deleted. Try again.");
  }

  // 5. Database rows, in one transaction (see sql/deletion-migration.sql).
  const { error: purgeError } = await admin.rpc("purge_user_data", { p_user_id: user.id });
  if (purgeError) {
    console.error("purge_user_data failed for request", request.id);
    return abort("We couldn't finish deleting your account. Try again or contact support.");
  }

  // 6. The auth user. Your data is already gone, so a failure here leaves only
  //    an orphaned login: say so plainly instead of "deletion failed".
  const { error: authError } = await admin.auth.admin.deleteUser(user.id);
  if (authError) {
    console.error("auth user delete failed for request", request.id);
    return {
      error:
        "Your profile and photos were deleted, but we couldn't remove your sign-in. Contact support to finish.",
    };
  }

  // 7. Mark complete and send the confirmation. Neither can undo the deletion,
  //    so failures are logged, never reported as "deletion failed".
  await admin
    .from("deletion_requests")
    .update({ completed_at: new Date().toISOString(), verified_method: VERIFIED_METHOD })
    .eq("id", request.id);

  const sent = await sendDeletionConfirmation(email);
  if (sent) {
    await admin
      .from("deletion_requests")
      .update({ confirmation_sent_at: new Date().toISOString() })
      .eq("id", request.id);
  } else {
    console.error("deletion confirmation email not sent for request", request.id);
  }

  await supabase.auth.signOut(); // clears cookies; session is already invalid
  redirect("/?account=deleted");
}
