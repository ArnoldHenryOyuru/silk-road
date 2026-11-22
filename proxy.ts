import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isMembersOnlyPath } from '@/lib/members-only'
import { DEMO_SESSION_COOKIE, isSupabaseConfigured } from '@/lib/supabase/demo-mode'
import { createDemoClient } from '@/lib/supabase/demo-store'

/**
 * Two jobs:
 *  1. Keeps the Supabase session fresh. Server Components can't write cookies,
 *     so without this a session that needs refreshing can silently expire.
 *  2. Sends signed-out visitors who open a members-only page to the home page
 *     (the "what to expect" preview), with ?next= so sign-in brings them back.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  let user: { id: string } | null = null

  if (!isSupabaseConfigured()) {
    const demo = createDemoClient({
      getUserId: () => request.cookies.get(DEMO_SESSION_COOKIE)?.value ?? null,
    })
    const { data } = await demo.auth.getUser()
    user = data.user
  } else {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            response = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
          },
        },
      }
    )

    const { data } = await supabase.auth.getUser()
    user = data.user
  }

  const { pathname, search } = request.nextUrl

  if (!user && isMembersOnlyPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    url.searchParams.set('next', pathname + search)

    const redirect = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|opengraph-image|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|txt|xml|woff2?)$).*)'],
}
