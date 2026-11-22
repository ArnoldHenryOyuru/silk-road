import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createDemoClient } from './demo-store'
import { isSupabaseAdminConfigured } from './demo-mode'

/**
 * Service-role client — bypasses RLS entirely.
 * Falls back to the in-memory demo store when Supabase secrets are unset.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createServiceClient(): ReturnType<typeof createSupabaseClient<any>> {
  if (!isSupabaseAdminConfigured()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createDemoClient({ getUserId: () => null }) as unknown as ReturnType<typeof createSupabaseClient<any>>
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
