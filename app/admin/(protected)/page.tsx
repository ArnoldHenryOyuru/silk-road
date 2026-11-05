import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import RangeSelect from '@/components/RangeSelect'
import { PLANS, isPlanId } from '@/lib/payments/plans'
import styles from './admin.module.css'

type Service = ReturnType<typeof createServiceClient>

const HOUR = 3_600_000
const DAY = 24 * HOUR
const RANGES: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }

function ago(iso?: string | null) {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 60) return `${Math.max(m, 1)}m`
  const h = Math.floor(m / 60)
  return h < 48 ? `${h}h` : `${Math.floor(h / 24)}d`
}

function pctChange(now: number, prev: number) {
  if (prev === 0) return now > 0 ? '+100%' : '0%'
  const p = Math.round(((now - prev) / prev) * 100)
  return `${p >= 0 ? '+' : ''}${p}%`
}

// Count + oldest created_at for one pending queue
async function pending(service: Service, table: string, status: string) {
  const { count, data } = await service
    .from(table)
    .select('created_at', { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: true })
    .limit(1)
  return { count: count ?? 0, oldest: (data?.[0]?.created_at as string | undefined) ?? null }
}

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const { range = '7d' } = await searchParams
  const days = RANGES[range] ?? 7
  const service = createServiceClient()

  const now = Date.now()
  const since = new Date(now - days * DAY).toISOString()
  const prevSince = new Date(now - 2 * days * DAY).toISOString()
  const dayAgo = new Date(now - DAY).toISOString()

  const [
    profiles, photos, edits, reports,
    reportsOld,
    signupsNow, signupsPrev,
    subs,
    subsNow, subsPrev,
    chartRows,
    queueProfiles, queuePhotos, queueEdits, queueReports,
    actPhotos, actEdits, actSubs,
  ] = await Promise.all([
    pending(service, 'profiles', 'pending_review'),
    pending(service, 'profile_photos', 'pending'),
    pending(service, 'profile_edits', 'pending_review'),
    pending(service, 'reports', 'open'),
    service.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open').lt('created_at', dayAgo),

    service.from('profiles').select('user_id', { count: 'exact' }).gte('created_at', since).limit(5000),
    service.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', prevSince).lt('created_at', since),

    // Active = status active and not yet expired
    service.from('subscriptions').select('plan_type').eq('status', 'active').gt('end_date', new Date().toISOString()),

    // Plans started this period / the previous period (each row = one paid plan)
    service.from('subscriptions').select('plan_type, user_id').gte('start_date', since),
    service.from('subscriptions').select('plan_type').gte('start_date', prevSince).lt('start_date', since),

    service.from('profiles').select('status, created_at').in('status', ['approved', 'rejected']).gte('created_at', since),

    service.from('profiles').select('id, created_at, campus').eq('status', 'pending_review').order('created_at').limit(4),
    service.from('profile_photos').select('profile_id, created_at').eq('status', 'pending').order('created_at').limit(50),
    service.from('profile_edits').select('id, created_at').eq('status', 'pending_review').order('created_at').limit(4),
    service.from('reports').select('id, created_at, reason').eq('status', 'open').order('created_at').limit(4),

    // Recent activity is derived from existing tables (no activity_log needed)
    service.from('profile_photos').select('status, rejection_reason, reviewed_at').in('status', ['approved', 'rejected']).not('reviewed_at', 'is', null).order('reviewed_at', { ascending: false }).limit(4),
    service.from('profile_edits').select('status, reviewed_at').in('status', ['approved', 'rejected']).not('reviewed_at', 'is', null).order('reviewed_at', { ascending: false }).limit(4),
    service.from('subscriptions').select('plan_type, start_date').order('start_date', { ascending: false }).limit(4),
  ])

  // ---- Growth & revenue
  const signups = signupsNow.count ?? 0
  const weekly = (subs.data ?? []).filter((s) => s.plan_type?.toLowerCase() === 'weekly').length
  const monthly = (subs.data ?? []).filter((s) => s.plan_type?.toLowerCase() === 'monthly').length

  // Revenue = plans started in the period x the price in lib/plans.ts
  const price = (t?: string | null) => {
    const id = (t ?? '').toLowerCase()
    return isPlanId(id) ? PLANS[id].amount : 0
  }
  const revenue = (subsNow.data ?? []).reduce((a, s) => a + price(s.plan_type), 0)
  const revenuePrev = (subsPrev.data ?? []).reduce((a, s) => a + price(s.plan_type), 0)

  // Signup to paid: people who signed up this period AND started a plan this period
  const signupIds = new Set((signupsNow.data ?? []).map((p) => p.user_id))
  const payers = new Set((subsNow.data ?? []).filter((s) => signupIds.has(s.user_id)).map((s) => s.user_id)).size
  const signupToPaid = signups ? Math.round((payers / signups) * 100) : 0

  const money = (n: number) => (n >= 1_000_000 ? `UGX ${(n / 1_000_000).toFixed(1)}M` : `UGX ${Math.round(n / 1000)}K`)

  // ---- Chart buckets
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(now - (days - 1 - i) * DAY)
    return {
      key: d.toISOString().slice(0, 10),
      label: days <= 7 ? d.toLocaleDateString('en-GB', { weekday: 'short' }) : d.getDate().toString(),
      approved: 0,
      rejected: 0,
    }
  })
  for (const r of chartRows.data ?? []) {
    const b = buckets.find((x) => x.key === String(r.created_at).slice(0, 10))
    if (b) r.status === 'approved' ? b.approved++ : b.rejected++
  }
  const max = Math.max(1, ...buckets.map((b) => b.approved + b.rejected))

  // ---- Review next (oldest first across all queues)
  const photoGroups = new Map<string, { n: number; oldest: string }>()
  for (const p of queuePhotos.data ?? []) {
    const g = photoGroups.get(p.profile_id)
    photoGroups.set(p.profile_id, { n: (g?.n ?? 0) + 1, oldest: g?.oldest ?? p.created_at })
  }
  const queue = [
    ...(queueReports.data ?? []).map((r) => ({
      tag: 'Report', tone: 'tagReport', title: r.reason ?? 'Open report', at: r.created_at, href: '/admin/reports',
    })),
    ...(queueProfiles.data ?? []).map((p) => ({
      tag: 'Profile', tone: 'tagProfile', title: `New signup${p.campus ? `, ${p.campus}` : ''}`, at: p.created_at, href: '/admin/profiles',
    })),
    ...[...photoGroups.values()].map((g) => ({
      tag: 'Photo', tone: 'tagPhoto', title: g.n === 1 ? '1 photo from one member' : `${g.n} photos from one member`, at: g.oldest, href: '/admin/photos',
    })),
    ...(queueEdits.data ?? []).map((e) => ({
      tag: 'Bio', tone: 'tagBio', title: 'Bio changed, diff view', at: e.created_at, href: '/admin/edits',
    })),
  ]
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .slice(0, 4)

  const cap = (t?: string | null) => (t ? t[0].toUpperCase() + t.slice(1) : 'Plan')
  const activity = [
    ...(actPhotos.data ?? []).map((p) => ({
      kind: p.status === 'approved' ? 'approved' : 'rejected',
      message: p.status === 'approved' ? 'Photo approved' : `Photo rejected${p.rejection_reason ? `, reason: ${p.rejection_reason}` : ''}`,
      at: p.reviewed_at as string,
    })),
    ...(actEdits.data ?? []).map((e) => ({
      kind: e.status === 'approved' ? 'approved' : 'rejected',
      message: e.status === 'approved' ? 'Bio edit approved' : 'Bio edit rejected',
      at: e.reviewed_at as string,
    })),
    ...(actSubs.data ?? []).map((s) => ({
      kind: 'payment',
      message: `${cap(s.plan_type)} plan started`,
      at: s.start_date as string,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 4)

  const attention = [
    { label: 'Pending profiles', ...profiles, href: '/admin/profiles', hint: `oldest waiting ${ago(profiles.oldest)}`, tone: 'warn' },
    { label: 'Pending photos', ...photos, href: '/admin/photos', hint: `oldest waiting ${ago(photos.oldest)}`, tone: '' },
    { label: 'Bio edits', ...edits, href: '/admin/edits', hint: `oldest waiting ${ago(edits.oldest)}`, tone: '' },
    {
      label: 'Open reports', ...reports, href: '/admin/reports',
      hint: reportsOld.count ? `${reportsOld.count} older than 24h` : 'all within 24h',
      tone: reportsOld.count ? 'bad' : '',
    },
  ]

  return (
    <div className={styles.main}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>Overview</h1>
          <p className={styles.pageSub}>Snapshot of everything waiting on you right now.</p>
        </div>
        <RangeSelect value={range} />
      </div>

      <h2 className={styles.sectionLabel}>Needs your attention</h2>
      <div className={styles.statGrid}>
        {attention.map((c) => (
          <Link key={c.href} href={c.href} className={styles.statCard}>
            <div className={styles.statLabel}>{c.label}</div>
            <div className={styles.statNum}>{c.count}</div>
            <div className={`${styles.statHint} ${c.tone === 'warn' ? styles.hintWarn : c.tone === 'bad' ? styles.hintBad : ''}`}>
              {c.hint}
            </div>
          </Link>
        ))}
      </div>

      <h2 className={styles.sectionLabel}>Growth and revenue</h2>
      <div className={styles.statGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>New signups</div>
          <div className={styles.statNum}>{signups}</div>
          <div className={`${styles.statHint} ${styles.hintGood}`}>{pctChange(signups, signupsPrev.count ?? 0)} vs last period</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Active subscribers</div>
          <div className={styles.statNum}>{weekly + monthly}</div>
          <div className={styles.statHint}>{weekly} weekly, {monthly} monthly</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Revenue</div>
          <div className={styles.statNum}>{money(revenue)}</div>
          <div className={`${styles.statHint} ${styles.hintGood}`}>{pctChange(revenue, revenuePrev)} vs last period</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Signup to paid</div>
          <div className={styles.statNum}>{signupToPaid}%</div>
          <div className={styles.statHint}>{payers} of {signups} signups paid</div>
        </div>
      </div>

      <div className={styles.twoCol}>
        <section className={styles.panel}>
          <h3 className={styles.panelTitle}>Signups per day</h3>
          <p className={styles.panelSub}>Approved vs rejected</p>
          <div className={styles.chart}>
            {buckets.map((b) => {
              const total = b.approved + b.rejected
              return (
                <div key={b.key} className={styles.barCol}>
                  <div className={styles.bar} style={{ height: `${(total / max) * 100}%` }} title={`${b.approved} approved, ${b.rejected} rejected`}>
                    <div className={styles.barApproved} style={{ flex: b.approved }} />
                    {b.rejected > 0 && <div className={styles.barRejected} style={{ flex: b.rejected }} />}
                  </div>
                  <span className={styles.barLabel}>{b.label}</span>
                </div>
              )
            })}
          </div>
        </section>

        <section className={styles.panel}>
          <h3 className={styles.panelTitle}>Review next</h3>
          {queue.length === 0 && <div className={styles.emptyState}>Nothing waiting. Nice.</div>}
          {queue.map((q, i) => (
            <div key={i} className={styles.reviewRow}>
              <span className={`${styles.tag} ${styles[q.tone]}`}>{q.tag}</span>
              <span className={styles.reviewTitle}>{q.title}</span>
              <span className={styles.queueTime}>{ago(q.at)}</span>
              <Link href={q.href} className={`${styles.btn} ${styles.view}`}>Open</Link>
            </div>
          ))}
        </section>
      </div>

      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>Recent activity</h3>
        {activity.length === 0 && <div className={styles.emptyState}>No activity yet.</div>}
        {activity.map((a, i) => (
          <div key={i} className={styles.activityRow}>
            <span className={`${styles.dot} ${styles['dot_' + a.kind] ?? ''}`} />
            <span className={styles.activityMsg}>{a.message}</span>
            <span className={styles.queueTime}>{ago(a.at)} ago</span>
          </div>
        ))}
      </section>
    </div>
  )
}
