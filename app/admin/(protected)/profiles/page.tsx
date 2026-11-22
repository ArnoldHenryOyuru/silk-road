import { createServiceClient } from '@/lib/supabase/service'
import ProfileQueueCard, { type PendingProfileCard } from './ProfileQueueCard'
import styles from '../admin.module.css'

export default async function PendingProfilesPage() {
  const service = createServiceClient()
  const nowIso = new Date().toISOString()

  const { data: profiles } = await service
    .from('profiles')
    .select(
      `
      id, user_id, display_name, age, campus, bio, looking_for, created_at,
      profile_photos ( image_url, status, is_primary )
    `
    )
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true })

  const pendingList = profiles ?? []
  const userIds = pendingList.map((p: { user_id: string }) => p.user_id).filter(Boolean)

  const paidByUser = new Map<string, string>()
  const reportedUsers = new Set<string>()

  if (userIds.length > 0) {
    const [{ data: activeSubs }, { data: openReports }] = await Promise.all([
      service
        .from('subscriptions')
        .select('user_id, plan_type')
        .in('user_id', userIds)
        .eq('status', 'active')
        .gte('end_date', nowIso),
      service
        .from('reports')
        .select('reported_user_id')
        .in('reported_user_id', userIds)
        .eq('status', 'open'),
    ])

    for (const s of activeSubs ?? []) {
      paidByUser.set(String(s.user_id), String(s.plan_type))
    }
    for (const r of openReports ?? []) {
      reportedUsers.add(String(r.reported_user_id))
    }
  }

  const cards: PendingProfileCard[] = await Promise.all(
    pendingList.map(async (p: {
      id: string
      user_id: string
      display_name: string
      age: number | null
      campus: string | null
      bio: string | null
      looking_for: string | null
      created_at: string
      profile_photos?: Array<{ image_url: string; status: string; is_primary: boolean }>
    }) => {
      const photos = p.profile_photos ?? []
      const thumbSource = photos.find((ph) => ph.is_primary) ?? photos[0]
      let thumbUrl: string | null = null
      if (thumbSource) {
        const { data } = await service.storage.from('profile-photos').createSignedUrl(thumbSource.image_url, 3600)
        thumbUrl = data?.signedUrl ?? null
      }
      const planType = paidByUser.get(p.user_id) ?? null
      return {
        id: p.id,
        displayName: p.display_name,
        age: p.age ?? null,
        campus: p.campus ?? null,
        bio: p.bio,
        lookingFor: p.looking_for,
        photoCount: photos.length,
        createdAt: p.created_at,
        thumbUrl,
        isPaid: Boolean(planType),
        planType,
        isReported: reportedUsers.has(p.user_id),
      }
    })
  )

  // Priority queue sort:
  // 1. Paid + Reported -> 2. Paid awaiting review -> 3. Reported -> 4. Standard pending
  // Within each tier, oldest-first.
  const priorityScore = (c: PendingProfileCard) => (c.isPaid ? 2 : 0) + (c.isReported ? 1 : 0)
  const sortedCards = [...cards].sort((a, b) => {
    const diff = priorityScore(b) - priorityScore(a)
    if (diff !== 0) return diff
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })

  const paidWaitingCount = sortedCards.filter((c) => c.isPaid).length

  return (
    <div className={styles.main}>
      <h1 className={styles.pageTitle}>Pending Profiles</h1>
      <p className={styles.pageSub}>
        Sorted with paid members and reported profiles first.
        {paidWaitingCount > 0
          ? ` ${paidWaitingCount} paid member${paidWaitingCount === 1 ? ' is' : 's are'} awaiting review right now.`
          : ''}
      </p>

      {sortedCards.length === 0 ? (
        <div className={styles.emptyState}>Nothing waiting here right now.</div>
      ) : (
        sortedCards.map((c) => <ProfileQueueCard key={c.id} profile={c} />)
      )}
    </div>
  )
}
