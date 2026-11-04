import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isMembersOnlyPath } from '@/lib/members-only'

/**
 * Two jobs:
 *  1. Keeps the Supabase session fresh. Server Components can't write cookies,
 *     so without this a session that needs refreshing can silently expire.
 *  2. Sends signed-out visitors who open a members-only page to the home page
 *     (the "what to expect" preview), with ?next= so sign-in brings them back.
 *
 * Anything not listed in lib/members-only.ts still falls back to the redirect
 * in app/(app)/layout.tsx.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname, search } = request.nextUrl

  if (!user && isMembersOnlyPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    url.searchParams.set('next', pathname + search)

    const redirect = NextResponse.redirect(url)
    // Keep any cookies Supabase just set (for example a cleared session).
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  return response
}

export const config = {
  // Skip static files and /api (payment webhooks etc. don't need a session here).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|txt|xml|woff2?)$).*)'],
}
