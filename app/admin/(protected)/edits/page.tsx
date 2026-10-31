import { createServiceClient } from '@/lib/supabase/service'
import EditQueueCard, { type PendingEditCard } from './EditQueueCard'
import styles from '../admin.module.css'

export default async function BioEditsPage() {
  const service = createServiceClient()

  const { data: edits } = await service
    .from('profile_edits')
    .select('id, old_value, new_value, created_at, profiles ( display_name, age )')
    .eq('status', 'pending_review')
    .eq('field_changed', 'bio')
    .order('created_at', { ascending: true })

  const cards: PendingEditCard[] = (edits ?? []).map((e: any) => ({
    id: e.id,
    displayName: e.profiles?.display_name ?? 'Unknown',
    age: e.profiles?.age ?? 0,
    oldValue: e.old_value,
    newValue: e.new_value,
  }))

  return (
    <div className={styles.main}>
      <h1 className={styles.pageTitle}>Bio Edits</h1>
      <p className={styles.pageSub}>Bio changes to already-approved profiles, held for a quick re-review.</p>

      {cards.length === 0 ? (
        <div className={styles.emptyState}>Nothing waiting here right now.</div>
      ) : (
        cards.map((c) => <EditQueueCard key={c.id} edit={c} />)
      )}
    </div>
  )
}
