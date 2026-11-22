import { createServiceClient } from '@/lib/supabase/service'
import PhotoQueueCard, { type PendingPhotoCard } from './PhotoQueueCard'
import styles from '../admin.module.css'

export default async function PendingPhotosPage() {
  const service = createServiceClient()

  const { data: photos } = await service
    .from('profile_photos')
    .select('id, image_url, is_primary, created_at, profiles ( display_name, age )')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  type PhotoQueueRow = {
    id: string
    image_url: string
    is_primary: boolean
    profiles?: { display_name?: string; age?: number } | Array<{ display_name?: string; age?: number }> | null
  }
  const cards: PendingPhotoCard[] = await Promise.all(
    ((photos ?? []) as PhotoQueueRow[]).map(async (p) => {
      const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles
      const { data } = await service.storage.from('profile-photos').createSignedUrl(p.image_url, 3600)
      return {
        id: p.id,
        url: data?.signedUrl ?? '',
        displayName: profile?.display_name ?? 'Unknown',
        age: profile?.age ?? 0,
        isPrimary: !!p.is_primary,
      }
    })
  )

  const visibleCards = cards.filter((c) => c.url)

  return (
    <div className={styles.main}>
      <h1 className={styles.pageTitle}>Pending Photos</h1>
      <p className={styles.pageSub}>Photos added to already-approved profiles — a main-photo swap or a new addition.</p>

      {visibleCards.length === 0 ? (
        <div className={styles.emptyState}>Nothing waiting here right now.</div>
      ) : (
        <div className={styles.photoGrid}>
          {visibleCards.map((c) => (
            <PhotoQueueCard key={c.id} photo={c} />
          ))}
        </div>
      )}
    </div>
  )
}
