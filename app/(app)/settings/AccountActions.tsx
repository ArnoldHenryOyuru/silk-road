"use client";

// Next 15 / React 19: useActionState from "react".
// On Next 14 use: import { useFormState as useActionState } from "react-dom";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { deactivateAccount, deleteAccount, type ActionState } from "./actions";
import styles from "./settings.module.css";

const initial: ActionState = {};

function SubmitButton({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={danger ? styles.dangerButton : styles.button}
    >
      {pending ? "Working…" : children}
    </button>
  );
}

export default function AccountActions({ status }: { status: string }) {
  const [deactivateState, deactivateAction] = useActionState(deactivateAccount, initial);
  const [deleteState, deleteAction] = useActionState(deleteAccount, initial);

  const underReview = status === "suspended" || status === "banned";

  if (underReview) {
    return (
      <section className={styles.section}>
        <h2 className={styles.heading}>Account under review</h2>
        <p className={styles.body}>
          Your account is currently {status}. You can&apos;t deactivate or delete it while it&apos;s under
          review. Contact support if you have questions.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className={styles.section}>
        <h2 className={styles.heading}>Deactivate account</h2>
        <p className={styles.body}>
          Hide your profile from Discover and sign out. Your photos and details are kept, and you
          can come back by signing in again.
        </p>
        <details className={styles.details}>
          <summary className={styles.summary}>Deactivate account</summary>
          <form action={deactivateAction} className={styles.form}>
            <p className={styles.body}>Other people won&apos;t be able to find or contact you.</p>
            {deactivateState.error && (
              <p role="alert" className={styles.error}>
                {deactivateState.error}
              </p>
            )}
            <SubmitButton>Deactivate account</SubmitButton>
          </form>
        </details>
      </section>

      <section className={`${styles.section} ${styles.danger}`}>
        <h2 className={styles.heading}>Delete account</h2>
        <p className={styles.body}>
          Permanently delete your profile, photos and sign-in. This can&apos;t be undone, and any
          subscription ends immediately without a refund.
        </p>
        <details className={styles.details}>
          <summary className={styles.summary}>Delete account permanently</summary>
          <form action={deleteAction} className={styles.form} autoComplete="off">
            <label className={styles.label} htmlFor="confirmation">
              Type DELETE to confirm
            </label>
            <input
              id="confirmation"
              name="confirmation"
              type="text"
              required
              autoComplete="off"
              className={styles.input}
            />

            <label className={styles.label} htmlFor="password">
              Your password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className={styles.input}
            />

            {deleteState.error && (
              <p role="alert" className={styles.error}>
                {deleteState.error}
              </p>
            )}
            <SubmitButton danger>Delete account permanently</SubmitButton>
          </form>
        </details>
      </section>
    </>
  );
}
