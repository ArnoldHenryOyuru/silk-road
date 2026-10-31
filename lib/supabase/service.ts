import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role client — bypasses RLS entirely.
 *
 * Server-only. Never import from a Client Component, and never prefix
 * SUPABASE_SERVICE_ROLE_KEY with NEXT_PUBLIC_.
 *
 * Used for: the phone-number lookup on WhatsApp contact (spec §9's
 * high-scrutiny phone-exposure event), and payment-webhook writes to
 * `subscriptions`. Every call site should do its own authorization check
 * before touching this client — it will happily do whatever you ask.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
