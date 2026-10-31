import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server"; // match your existing helper
import AccountActions from "./AccountActions";
import styles from "./settings.module.css";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  // Account status lives on public.users (id = auth user id).
  const { data: account } = await supabase
    .from("users")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  const status = account?.status ?? "active";

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Settings</h1>

      <section className={styles.section}>
        <h2 className={styles.heading}>Account</h2>
        <dl className={styles.facts}>
          <dt>Email</dt>
          <dd>{user.email}</dd>
        </dl>
      </section>

      <AccountActions status={status} />
    </main>
  );
}
