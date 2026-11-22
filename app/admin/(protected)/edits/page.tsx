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

  type EditRow = {
    id: string
    old_value: string
    new_value: string
    profiles?: { display_name?: string; age?: number } | Array<{ display_name?: string; age?: number }> | null
  }
  const cards: PendingEditCard[] = ((edits ?? []) as EditRow[]).map((e) => {
    const profile = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles
    return {
      id: e.id,
      displayName: profile?.display_name ?? 'Unknown',
      age: profile?.age ?? 0,
      oldValue: e.old_value,
      newValue: e.new_value,
    }
  })

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
