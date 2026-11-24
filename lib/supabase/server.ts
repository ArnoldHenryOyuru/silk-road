import { cache } from 'react'
import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { createDemoClient } from './demo-store'
import { DEMO_SESSION_COOKIE, isSupabaseConfigured } from './demo-mode'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createClient(): Promise<ReturnType<typeof createServerClient<any>>> {
  const cookieStore = await cookies()

  if (!isSupabaseConfigured()) {
    let isHttps = false
    try {
      const hdrs = await headers()
      isHttps = hdrs.get('x-forwarded-proto') === 'https'
    } catch {
      isHttps = false
    }

    const demo = createDemoClient({
      getUserId: () => cookieStore.get(DEMO_SESSION_COOKIE)?.value ?? null,
      setUserId: (id: string) => {
        try {
          cookieStore.set(DEMO_SESSION_COOKIE, id, {
            httpOnly: true,
            secure: isHttps,
            sameSite: isHttps ? 'none' : 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7,
            ...(isHttps ? { partitioned: true } : {}),
          } as Parameters<typeof cookieStore.set>[2])
        } catch {
          // Server Components cannot mutate cookies directly; ignore safely.
        }
      },
      clearUserId: () => {
        try {
          cookieStore.delete(DEMO_SESSION_COOKIE)
        } catch {
          // Server Components cannot mutate cookies directly; ignore safely.
        }
      },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return demo as unknown as ReturnType<typeof createServerClient<any>>
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component with no response to write to —
            // safe to ignore as long as proxy.ts is refreshing sessions.
          }
        },
      },
    }
  )
}

export const getCachedAuthUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
})
