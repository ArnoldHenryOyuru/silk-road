import { createServiceClient } from '@/lib/supabase/service'
import ReportQueueCard, { type ReportCard } from './ReportQueueCard'
import styles from '../admin.module.css'

export default async function ReportsPage() {
  const service = createServiceClient()

  const { data: reports } = await service
    .from('reports')
    .select('id, reason, reporter_id, reported_user_id, created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: true })

  const cards: ReportCard[] = await Promise.all(
    (reports ?? []).map(async (r) => {
      const [{ data: reporterProfile }, { data: reportedProfile }] = await Promise.all([
        service.from('profiles').select('display_name').eq('user_id', r.reporter_id).maybeSingle(),
        service.from('profiles').select('display_name').eq('user_id', r.reported_user_id).maybeSingle(),
      ])
      return {
        id: r.id,
        reason: r.reason,
        reporterName: reporterProfile?.display_name ?? 'Unknown',
        reportedName: reportedProfile?.display_name ?? 'Unknown',
        createdAt: r.created_at,
      }
    })
  )

  return (
    <div className={styles.main}>
      <h1 className={styles.pageTitle}>Reports</h1>
      <p className={styles.pageSub}>Open reports filed by users, oldest first.</p>

      {cards.length === 0 ? (
        <div className={styles.emptyState}>Nothing waiting here right now.</div>
      ) : (
        cards.map((c) => <ReportQueueCard key={c.id} report={c} />)
      )}
    </div>
  )
}
