import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import styles from './admin.module.css'

export default async function AdminOverviewPage() {
  const service = createServiceClient()

  const [profiles, photos, edits, reports] = await Promise.all([
    service.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
    service.from('profile_photos').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    service.from('profile_edits').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
    service.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
  ])

  const cards = [
    { label: 'Profiles pending', count: profiles.count ?? 0, href: '/admin/profiles' },
    { label: 'Photos pending', count: photos.count ?? 0, href: '/admin/photos' },
    { label: 'Bio edits pending', count: edits.count ?? 0, href: '/admin/edits' },
    { label: 'Open reports', count: reports.count ?? 0, href: '/admin/reports' },
  ]

  return (
    <div className={styles.main}>
      <h1 className={styles.pageTitle}>Overview</h1>
      <p className={styles.pageSub}>Snapshot of everything waiting on you right now.</p>

      <div className={styles.statGrid}>
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className={styles.statCard}>
            <div className={`${styles.statNum} ${c.count > 0 ? styles.warn : ''}`}>{c.count}</div>
            <div className={styles.statLabel}>{c.label}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
