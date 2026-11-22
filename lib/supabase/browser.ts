import { createBrowserClient } from '@supabase/ssr'
import { isSupabaseConfigured } from './demo-mode'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createClient(): ReturnType<typeof createBrowserClient<any>> {
  if (!isSupabaseConfigured()) {
    return {
      auth: {
        async getSession() {
          return { data: { session: null }, error: null }
        },
        async getUser() {
          return { data: { user: null }, error: null }
        },
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as unknown as ReturnType<typeof createBrowserClient<any>>
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
