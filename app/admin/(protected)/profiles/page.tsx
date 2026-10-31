import { createServiceClient } from '@/lib/supabase/service'
import ProfileQueueCard, { type PendingProfileCard } from './ProfileQueueCard'
import styles from '../admin.module.css'

export default async function PendingProfilesPage() {
  const service = createServiceClient()

  const { data: profiles } = await service
    .from('profiles')
    .select(
      `
      id, display_name, age, campus, bio, looking_for, created_at,
      profile_photos ( image_url, status, is_primary )
    `
    )
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true })

  const cards: PendingProfileCard[] = await Promise.all(
    (profiles ?? []).map(async (p: any) => {
      const photos = p.profile_photos ?? []
      const thumbSource = photos.find((ph: any) => ph.is_primary) ?? photos[0]
      let thumbUrl: string | null = null
      if (thumbSource) {
        const { data } = await service.storage.from('profile-photos').createSignedUrl(thumbSource.image_url, 3600)
        thumbUrl = data?.signedUrl ?? null
      }
      return {
        id: p.id,
        displayName: p.display_name,
        age: p.age,
        campus: p.campus,
        bio: p.bio,
        lookingFor: p.looking_for,
        photoCount: photos.length,
        createdAt: p.created_at,
        thumbUrl,
      }
    })
  )

  return (
    <div className={styles.main}>
      <h1 className={styles.pageTitle}>Pending Profiles</h1>
      <p className={styles.pageSub}>New profiles waiting for first-time approval before they appear on Discover.</p>

      {cards.length === 0 ? (
        <div className={styles.emptyState}>Nothing waiting here right now.</div>
      ) : (
        cards.map((c) => <ProfileQueueCard key={c.id} profile={c} />)
      )}
    </div>
  )
}
