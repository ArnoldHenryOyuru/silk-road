import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCachedAuthUser } from '@/lib/supabase/server'
import { getContactAllowance } from '@/lib/contact'
import {
  applyDiscoverFilters,
  buildDiscoverHref,
  countActiveDiscoverFilters,
  parseDiscoverFilters,
} from '@/lib/discover-filters'
import type { DiscoverProfile } from '@/types/discover'
import DiscoverGrid from './DiscoverGrid'
import DiscoverPagination from './DiscoverPagination'
import { DiscoverActiveFilters, DiscoverFilterButton } from './DiscoverFiltersUI'
import styles from './discover.module.css'

// 4 columns x 5 rows on a desktop screen (2 x 10 on a phone).
const PAGE_SIZE = 20

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function isNewProfile(createdAt: string) {
  const created = new Date(createdAt).getTime()
  const sevenDays = 7 * 24 * 60 * 60 * 1000
  return Date.now() - created < sevenDays
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[]
    campus?: string | string[]
    lookingFor?: string | string[]
    minAge?: string | string[]
    maxAge?: string | string[]
    verified?: string | string[]
  }>
}) {
  const params = await searchParams
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page
  const parsed = Number.parseInt(rawPage ?? '1', 10)
  const requestedPage = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1

  const filters = parseDiscoverFilters(params)
  const activeFilterCount = countActiveDiscoverFilters(filters)

  const { supabase, user } = await getCachedAuthUser()
  // (app)/layout.tsx already redirects if there's no user — this is just
  // for the TypeScript narrowing below.
  if (!user) return null

  // Round 1: fetch blocks, likes, and daily contact allowance concurrently.
  const [{ data: blocks }, { data: likes }, allowance] = await Promise.all([
    supabase
      .from('blocks')
      .select('blocker_id, blocked_id')
      .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`),
    supabase.from('likes').select('liked_profile_id').eq('liker_id', user.id),
    getContactAllowance(user.id),
  ])

  const blockedUserIds = [
    ...new Set((blocks ?? []).flatMap((b) => [b.blocker_id, b.blocked_id]).filter((id) => id !== user.id)),
  ]
  const excludeBlocked = blockedUserIds.length > 0 ? `(${blockedUserIds.join(',')})` : null

  // Round 2: fetch the paged feed AND exact total count in one single query.
  const page = requestedPage
  const from = (page - 1) * PAGE_SIZE

  let profilesQuery = supabase
    .from('profiles')
    .select(
      `
      id, user_id, display_name, age, campus, looking_for, face_match_verified, created_at,
      profile_photos ( image_url, status, is_primary )
    `,
      { count: 'exact' }
    )
    .eq('status', 'approved')
    .eq('is_discoverable', true)
    .neq('user_id', user.id)
  if (excludeBlocked) profilesQuery = profilesQuery.not('user_id', 'in', excludeBlocked)
  profilesQuery = applyDiscoverFilters(profilesQuery, filters)

  const { data: profiles, count: total, error } = await profilesQuery
    .order('created_at', { ascending: false })
    .order('id', { ascending: false }) // tie-breaker: keeps pages stable
    .range(from, from + PAGE_SIZE - 1)

  if (error) {
    throw new Error(`Failed to load Discover feed: ${error.message}`)
  }

  const totalMatches = total ?? 0
  const totalPages = Math.max(1, Math.ceil(totalMatches / PAGE_SIZE))
  if (requestedPage > totalPages) {
    redirect(buildDiscoverHref(filters, totalPages))
  }

  const isSubscribed = allowance.subscribed

  const likedProfileIds = new Set((likes ?? []).map((l) => l.liked_profile_id))

  const visibleProfiles = profiles ?? []

  // Private bucket — raw storage paths aren't viewable directly. Pick each
  // profile's approved photo path, then sign all of them in ONE request.
  const photoPathByProfile = new Map<string, string>()
  for (const p of visibleProfiles) {
    const photoList = (p.profile_photos ?? []) as Array<{ status: string; image_url: string; is_primary?: boolean }>
    const approved =
      photoList.find((photo) => photo.status === 'approved' && photo.is_primary) ??
      photoList.find((photo) => photo.status === 'approved')
    if (approved) photoPathByProfile.set(p.id, approved.image_url)
  }

  const paths = [...new Set(photoPathByProfile.values())]
  const signedByPath = new Map<string, string>()

  if (paths.length > 0) {
    const { data: signedList, error: signError } = await supabase.storage
      .from('profile-photos')
      .createSignedUrls(paths, 3600)

    if (signError) {
      console.error('Discover: batch signing failed:', signError.message)
    }

    // Results are matched by path, not by index. A path that fails to sign
    // comes back with its own error, so one bad photo only falls back to
    // initials and doesn't break the rest.
    for (const item of signedList ?? []) {
      if (item.signedUrl && item.path) {
        signedByPath.set(item.path, item.signedUrl)
      } else if (item.error) {
        console.error('Discover: sign failed for', item.path, item.error)
      }
    }
  }

  const feed: DiscoverProfile[] = visibleProfiles.map((p) => {
    const path = photoPathByProfile.get(p.id)
    return {
      id: p.id,
      displayName: p.display_name,
      age: p.age,
      campus: p.campus,
      lookingFor: p.looking_for,
      verified: !!p.face_match_verified,
      isNew: isNewProfile(p.created_at),
      photoUrl: path ? (signedByPath.get(path) ?? null) : null,
      initials: getInitials(p.display_name),
      liked: likedProfileIds.has(p.id),
    }
  })

  return (
    <main className={styles.discoverMain}>
      <div className={styles.discoverHero}>
        <div className={styles.ghostText} aria-hidden="true">
          Discover
        </div>
        <div className={styles.discoverHeroRow}>
          <div>
            <h1>Discover</h1>
            <p>Verified students near you</p>
            {isSubscribed && allowance.limit > 0 && (
              <p className={styles.allowance} data-empty={allowance.remaining === 0}>
                {allowance.remaining > 0
                  ? allowance.isPendingCap
                    ? `${allowance.remaining} of ${allowance.limit} pending contact left today (full plan unlocks after approval)`
                    : `${allowance.remaining} of ${allowance.limit} contacts left today`
                  : `You've used all ${allowance.limit} contact${allowance.limit === 1 ? '' : 's'} for today. They reset at midnight.`}
              </p>
            )}
          </div>
          <DiscoverFilterButton initialFilters={filters} />
        </div>
      </div>

      {allowance.stage === 'draft' && (
        <div className={styles.stageBanner}>
          <div>
            <div className={styles.stageBannerTitle}>Finish your profile to submit for review</div>
            <div className={styles.stageBannerSub}>
              You can browse Discover right now. Complete your checklist and verify your email to subscribe and contact members.
            </div>
          </div>
          <Link href="/onboarding/profile" className={styles.stageBannerBtn}>
            Complete checklist
          </Link>
        </div>
      )}

      {allowance.stage === 'pending_review' && (
        <div className={`${styles.stageBanner} ${styles.stageBannerWarn}`}>
          <div>
            <div className={styles.stageBannerTitle}>Your profile is in review</div>
            <div className={styles.stageBannerSub}>
              {isSubscribed
                ? 'Your profile is hidden from others until approved. You can still message 1 person a day right now.'
                : 'Your profile is hidden until approved. You can subscribe now to unlock 1 contact a day while waiting.'}
            </div>
          </div>
          <Link href="/pending-review" className={styles.stageBannerBtn}>
            View status
          </Link>
        </div>
      )}

      {allowance.stage === 'rejected' && (
        <div className={`${styles.stageBanner} ${styles.stageBannerDanger}`}>
          <div>
            <div className={styles.stageBannerTitle}>Updates needed on your profile</div>
            <div className={styles.stageBannerSub}>
              Contacts are paused until you update &amp; resubmit (or request a refund within 14 days).
            </div>
          </div>
          <Link href="/pending-review" className={styles.stageBannerBtn}>
            Fix or manage plan
          </Link>
        </div>
      )}

      <DiscoverActiveFilters filters={filters} totalMatches={totalMatches} />

      {feed.length > 0 ? (
        <>
          <DiscoverGrid
            key={buildDiscoverHref(filters, page)}
            profiles={feed}
            isSubscribed={isSubscribed && allowance.limit > 0}
            contactLimit={allowance.limit}
          />
          <DiscoverPagination page={page} totalPages={totalPages} filters={filters} />
        </>
      ) : activeFilterCount > 0 ? (
        <div className={styles.emptyFiltered}>
          <h2 className={styles.emptyFilteredTitle}>No members match these filters</h2>
          <p className={styles.emptyFilteredSub}>
            Try widening your age range, adding another campus, or clearing your active filters.
          </p>
          <Link href="/discover" className={styles.emptyResetBtn}>
            Clear all filters
          </Link>
        </div>
      ) : (
        <p style={{ color: 'var(--text-secondary)', marginTop: 24 }}>
          No profiles to show yet — check back soon.
        </p>
      )}
    </main>
  )
}
