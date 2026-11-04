/**
 * Which pages are for signed-in members only, and a safe way to read the
 * ?next= value that sends visitors back to where they were headed.
 *
 * Used by middleware.ts, the home page and the sign-in action, so the list lives
 * in ONE place. Add a prefix here when you add a new members-only area.
 */
export const MEMBERS_ONLY_PREFIXES = ['/discover', '/profile', '/subscribe', '/onboarding', '/pending-review']

export function isMembersOnlyPath(pathname: string): boolean {
  return MEMBERS_ONLY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))
}

const DUMMY_ORIGIN = 'https://silk-road.invalid'

/**
 * Returns a safe in-site path from an untrusted ?next= value, or `fallback`.
 * Only members-only pages are accepted, so it can never become an open redirect
 * (no other websites, no //host, no backslash tricks, no javascript: links).
 */
export function safeNext(raw: unknown, fallback = '/discover'): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string' || value.length === 0 || value.length > 300) return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback

  let url: URL
  try {
    url = new URL(value, DUMMY_ORIGIN)
  } catch {
    return fallback
  }
  if (url.origin !== DUMMY_ORIGIN) return fallback
  if (!isMembersOnlyPath(url.pathname)) return fallback

  return url.pathname + url.search
}
