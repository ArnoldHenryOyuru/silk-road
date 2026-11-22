import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getContactAllowance } from '@/lib/contact'
import type { DiscoverProfile } from '@/types/discover'
import DiscoverGrid from './DiscoverGrid'
import DiscoverPagination from './DiscoverPagination'
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
  searchParams: Promise<{ page?: string | string[] }>
}) {
  const params = await searchParams
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page
  const parsed = Number.parseInt(rawPage ?? '1', 10)
  const requestedPage = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  // (app)/layout.tsx already redirects if there's no user — this is just
  // for the TypeScript narrowing below.
  if (!user) return null

  // Blocks first: blocked people must be left out BEFORE paging, otherwise
  // pages would come back with gaps.
  const { data: blocks } = await supabase
    .from('blocks')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`)

  const blockedUserIds = [
    ...new Set((blocks ?? []).flatMap((b) => [b.blocker_id, b.blocked_id]).filter((id) => id !== user.id)),
  ]
  const excludeBlocked = blockedUserIds.length > 0 ? `(${blockedUserIds.join(',')})` : null

  // How many pages are there?
  let countQuery = supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'approved')
    .eq('is_discoverable', true)
    .neq('user_id', user.id)
  if (excludeBlocked) countQuery = countQuery.not('user_id', 'in', excludeBlocked)
  const { count: total } = await countQuery

  const totalPages = Math.max(1, Math.ceil((total ?? 0) / PAGE_SIZE))
  if (requestedPage > totalPages) {
    redirect(totalPages === 1 ? '/discover' : `/discover?page=${totalPages}`)
  }
  const page = requestedPage
  const from = (page - 1) * PAGE_SIZE

  let profilesQuery = supabase
    .from('profiles')
    .select(
      `
      id, user_id, display_name, age, campus, looking_for, face_match_verified, created_at,
      profile_photos ( image_url, status )
    `
    )
    .eq('status', 'approved')
    .eq('is_discoverable', true)
    .neq('user_id', user.id)
  if (excludeBlocked) profilesQuery = profilesQuery.not('user_id', 'in', excludeBlocked)

  // These don't depend on each other, so run them together.
  const [{ data: profiles, error }, { data: likes }, allowance] = await Promise.all([
    profilesQuery
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }) // tie-breaker: keeps pages stable
      .range(from, from + PAGE_SIZE - 1),
    supabase.from('likes').select('liked_profile_id').eq('liker_id', user.id),
    getContactAllowance(user.id),
  ])

  if (error) {
    throw new Error(`Failed to load Discover feed: ${error.message}`)
  }

  const isSubscribed = allowance.subscribed

  const likedProfileIds = new Set((likes ?? []).map((l) => l.liked_profile_id))

  const visibleProfiles = profiles ?? []

  // Private bucket — raw storage paths aren't viewable directly. Pick each
  // profile's approved photo path, then sign all of them in ONE request.
  const photoPathByProfile = new Map<string, string>()
  for (const p of visibleProfiles) {
    const approved = (p.profile_photos ?? []).find(
      (photo: { status: string; image_url: string }) => photo.status === 'approved'
    )
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
          <button className={styles.filterBtn} aria-label="Filters" type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
              <circle cx="9" cy="7" r="1.6" fill="white" stroke="none" />
              <circle cx="15" cy="12" r="1.6" fill="white" stroke="none" />
              <circle cx="11" cy="17" r="1.6" fill="white" stroke="none" />
            </svg>
          </button>
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

      {feed.length > 0 ? (
        <>
          <DiscoverGrid
            profiles={feed}
            isSubscribed={isSubscribed && allowance.limit > 0}
            contactLimit={allowance.limit}
          />
          <DiscoverPagination page={page} totalPages={totalPages} />
        </>
      ) : (
        <p style={{ color: 'var(--text-secondary)', marginTop: 24 }}>
          No profiles to show yet — check back soon.
        </p>
      )}
    </main>
  )
}
