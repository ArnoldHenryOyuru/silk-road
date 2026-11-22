import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createDemoClient } from "./demo-store";
import { isSupabaseAdminConfigured } from "./demo-mode";

/**
 * Service-role client. Bypasses RLS, so it must only ever run on the server.
 * Falls back to the in-memory demo store when Supabase secrets are unset.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAdminClient(): ReturnType<typeof createClient<any>> {
  if (!isSupabaseAdminConfigured()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createDemoClient({ getUserId: () => null }) as unknown as ReturnType<typeof createClient<any>>;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
