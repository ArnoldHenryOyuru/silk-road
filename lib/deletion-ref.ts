import "server-only";
import { createHmac } from "crypto";

/**
 * Anonymised reference for the deletion audit log. A keyed hash (HMAC) of the
 * email, so the log never stores the email itself and the reference can't be
 * reversed by hashing a list of guessed emails without the secret.
 *
 * Needs DELETION_LOG_SECRET in .env.local: any long random string. Generate
 * one with:  openssl rand -hex 32   and don't change it later, or old
 * references will no longer match.
 */
export function userRef(email: string): string {
  const secret = process.env.DELETION_LOG_SECRET;
  if (!secret) throw new Error("Missing DELETION_LOG_SECRET");
  return createHmac("sha256", secret).update(email.trim().toLowerCase()).digest("hex");
}
