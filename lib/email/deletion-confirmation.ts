import "server-only";

/**
 * EDIT BEFORE LAUNCH: these two sentences must match your Privacy Policy and
 * what you actually do. Only claim what is true (verify your backup setup).
 */
const RETAINED_NOTE =
  "We keep a minimal record that a deletion happened, records of payments you made, and any safety reports made by or about you, all with your identity removed. None of it contains your name, photos, phone number or email address.";
const BACKUP_NOTE =
  "Copies held in backups are removed on the backup schedule described in our Privacy Policy.";

/**
 * Sends the deletion confirmation to the user's verified email via Resend.
 * Returns true only if Resend accepted the message. It never throws, so a
 * failed email can't undo or block a completed deletion.
 *
 * Needs RESEND_API_KEY and DELETION_EMAIL_FROM (for example
 * "Silk Road <noreply@mail.yourdomain.com>"). Until your sending domain is
 * verified in Resend, mail to anyone but your own account will be rejected,
 * and this returns false.
 */
export async function sendDeletionConfirmation(to: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.DELETION_EMAIL_FROM;
  if (!key || !from) return false;

  const text = [
    "Your Silk Road account has been permanently deleted.",
    "",
    "Removed: your profile, photos, phone number and sign-in details.",
    `Kept: ${RETAINED_NOTE}`,
    BACKUP_NOTE,
    "",
    "If you didn't request this, contact support right away.",
  ].join("\n");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "Your Silk Road account has been deleted",
        text,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
