import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import RangeSelect from '@/components/RangeSelect'
import { PLANS, isPlanId } from '@/lib/payments/plans'
import LifecycleSweepCard from './LifecycleSweepCard'
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

async function getAdminOverviewData(range: string) {
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
    allPendingProfiles, queuePhotos, queueEdits, queueReports,
    actPhotos, actEdits, actSubs,
  ] = await Promise.all([
    pending(service, 'profiles', 'pending_review'),
    pending(service, 'profile_photos', 'pending'),
    pending(service, 'profile_edits', 'pending_review'),
    pending(service, 'reports', 'open'),
    service.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open').lt('created_at', dayAgo),

    service.from('profiles').select('user_id, status, created_at', { count: 'exact' }).gte('created_at', since).limit(5000),
    service.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', prevSince).lt('created_at', since),

    // Active = status active and not yet expired
    service.from('subscriptions').select('plan_type, user_id').eq('status', 'active').gt('end_date', new Date(now).toISOString()),

    // Plans started this period / the previous period (each row = one paid plan)
    service.from('subscriptions').select('plan_type, user_id').gte('start_date', since),
    service.from('subscriptions').select('plan_type').gte('start_date', prevSince).lt('start_date', since),

    service.from('profiles').select('status, created_at').in('status', ['approved', 'rejected']).gte('created_at', since),

    service.from('profiles').select('id, user_id, created_at, campus').eq('status', 'pending_review').order('created_at').limit(500),
    service.from('profile_photos').select('profile_id, created_at').eq('status', 'pending').order('created_at').limit(50),
    service.from('profile_edits').select('id, created_at').eq('status', 'pending_review').order('created_at').limit(4),
    service.from('reports').select('id, created_at, reason').eq('status', 'open').order('created_at').limit(4),

    // Recent activity is derived from existing tables (no activity_log needed)
    service.from('profile_photos').select('status, rejection_reason, reviewed_at').in('status', ['approved', 'rejected']).not('reviewed_at', 'is', null).order('reviewed_at', { ascending: false }).limit(4),
    service.from('profile_edits').select('status, reviewed_at').in('status', ['approved', 'rejected']).not('reviewed_at', 'is', null).order('reviewed_at', { ascending: false }).limit(4),
    service.from('subscriptions').select('plan_type, start_date').order('start_date', { ascending: false }).limit(4),
  ])

  // ---- Growth, funnel & revenue
  const signupRows = (signupsNow.data ?? []) as Array<{ user_id: string; status: string; created_at: string }>
  const signups = signupsNow.count ?? signupRows.length
  const draftCount = signupRows.filter((p) => p.status === 'draft').length
  const submittedRows = signupRows.filter((p) => p.status !== 'draft')
  const submittedCount = submittedRows.length
  const approvedInPeriod = signupRows.filter((p) => p.status === 'approved').length
  const pendingInPeriod = signupRows.filter((p) => p.status === 'pending_review').length
  const rejectedInPeriod = signupRows.filter((p) => p.status === 'rejected').length

  const activeSubUserIds = new Set((subs.data ?? []).map((s) => String(s.user_id)))
  const weekly = (subs.data ?? []).filter((s) => s.plan_type?.toLowerCase() === 'weekly').length
  const monthly = (subs.data ?? []).filter((s) => s.plan_type?.toLowerCase() === 'monthly').length

  const paidPendingRows = (allPendingProfiles.data ?? []).filter((p) => activeSubUserIds.has(String(p.user_id)))
  const paidAwaitingReview = paidPendingRows.length
  const oldestPaidWaiting = (paidPendingRows[0]?.created_at as string | undefined) ?? null

  // Revenue = plans started in the period x the price in lib/plans.ts
  const price = (t?: string | null) => {
    const id = (t ?? '').toLowerCase()
    return isPlanId(id) ? PLANS[id].amount : 0
  }
  const revenue = (subsNow.data ?? []).reduce((a, s) => a + price(s.plan_type), 0)
  const revenuePrev = (subsPrev.data ?? []).reduce((a, s) => a + price(s.plan_type), 0)

  // Signup to paid: people who signed up this period AND started a plan this period
  const signupIds = new Set(signupRows.map((p) => p.user_id))
  const payers = new Set((subsNow.data ?? []).filter((s) => signupIds.has(s.user_id)).map((s) => s.user_id)).size
  const signupToPaid = signups ? Math.round((payers / signups) * 100) : 0
  const pctOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

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
    if (b) {
      if (r.status === 'approved') b.approved++
      else b.rejected++
    }
  }
  const max = Math.max(1, ...buckets.map((b) => b.approved + b.rejected))

  return {
    profiles,
    photos,
    edits,
    reports,
    reportsOld,
    signups,
    signupsPrevCount: signupsPrev.count ?? 0,
    draftCount,
    submittedCount,
    approvedInPeriod,
    pendingInPeriod,
    rejectedInPeriod,
    activeSubUserIds,
    weekly,
    monthly,
    paidAwaitingReview,
    oldestPaidWaiting,
    revenue,
    revenuePrev,
    payers,
    signupToPaid,
    pctOf,
    money,
    buckets,
    max,
    allPendingProfiles,
    queuePhotos,
    queueEdits,
    queueReports,
    actPhotos,
    actEdits,
    actSubs,
  }
}

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const { range = '7d' } = await searchParams
  const {
    profiles,
    photos,
    edits,
    reports,
    reportsOld,
    signups,
    signupsPrevCount,
    draftCount,
    submittedCount,
    approvedInPeriod,
    pendingInPeriod,
    rejectedInPeriod,
    activeSubUserIds,
    weekly,
    monthly,
    paidAwaitingReview,
    oldestPaidWaiting,
    revenue,
    revenuePrev,
    payers,
    signupToPaid,
    pctOf,
    money,
    buckets,
    max,
    allPendingProfiles,
    queuePhotos,
    queueEdits,
    queueReports,
    actPhotos,
    actEdits,
    actSubs,
  } = await getAdminOverviewData(range)

  // ---- Review next (paid pending + reports first, then oldest first)
  const photoGroups = new Map<string, { n: number; oldest: string }>()
  for (const p of queuePhotos.data ?? []) {
    const g = photoGroups.get(p.profile_id)
    photoGroups.set(p.profile_id, { n: (g?.n ?? 0) + 1, oldest: g?.oldest ?? p.created_at })
  }
  const topProfiles = [...(allPendingProfiles.data ?? [])]
    .sort((a, b) => {
      const aPaid = activeSubUserIds.has(String(a.user_id)) ? 1 : 0
      const bPaid = activeSubUserIds.has(String(b.user_id)) ? 1 : 0
      if (bPaid !== aPaid) return bPaid - aPaid
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
    .slice(0, 4)

  const queue = [
    ...(queueReports.data ?? []).map((r) => ({
      tag: 'Report', tone: 'tagReport', priority: 2, title: r.reason ?? 'Open report', at: r.created_at, href: '/admin/reports',
    })),
    ...topProfiles.map((p) => {
      const isPaid = activeSubUserIds.has(String(p.user_id))
      return {
        tag: isPaid ? 'Paid · Profile' : 'Profile',
        tone: isPaid ? 'tagReport' : 'tagProfile',
        priority: isPaid ? 2 : 0,
        title: `Profile review${p.campus ? `, ${p.campus}` : ''}`,
        at: p.created_at,
        href: '/admin/profiles',
      }
    }),
    ...[...photoGroups.values()].map((g) => ({
      tag: 'Photo', tone: 'tagPhoto', priority: 0, title: g.n === 1 ? '1 photo from one member' : `${g.n} photos from one member`, at: g.oldest, href: '/admin/photos',
    })),
    ...(queueEdits.data ?? []).map((e) => ({
      tag: 'Bio', tone: 'tagBio', priority: 0, title: 'Bio changed, diff view', at: e.created_at, href: '/admin/edits',
    })),
  ]
    .sort((a, b) => b.priority - a.priority || new Date(a.at).getTime() - new Date(b.at).getTime())
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
    {
      key: 'paid-awaiting',
      label: 'Paid, awaiting review',
      count: paidAwaitingReview,
      href: '/admin/profiles',
      hint: paidAwaitingReview > 0 ? `priority · oldest ${ago(oldestPaidWaiting)}` : 'all clear',
      tone: paidAwaitingReview > 0 ? 'bad' : '',
    },
    { key: 'profiles', label: 'Pending profiles', ...profiles, href: '/admin/profiles', hint: `oldest waiting ${ago(profiles.oldest)}`, tone: 'warn' },
    { key: 'photos', label: 'Pending photos', ...photos, href: '/admin/photos', hint: `oldest waiting ${ago(photos.oldest)}`, tone: '' },
    { key: 'edits', label: 'Bio edits', ...edits, href: '/admin/edits', hint: `oldest waiting ${ago(edits.oldest)}`, tone: '' },
    {
      key: 'reports',
      label: 'Open reports', ...reports, href: '/admin/reports',
      hint: reportsOld.count ? `${reportsOld.count} older than 24h` : 'all within 24h',
      tone: reportsOld.count ? 'bad' : '',
    },
  ]

  const funnelStages = [
    {
      label: 'Signed up',
      sub: `${draftCount} still in draft`,
      count: signups,
      pct: 100,
      fillClass: '',
    },
    {
      label: 'Profile submitted',
      sub: `${pendingInPeriod} waiting · ${rejectedInPeriod} rejected`,
      count: submittedCount,
      pct: pctOf(submittedCount, signups),
      fillClass: styles.funnelFillWarn,
    },
    {
      label: 'Approved',
      sub: `${pctOf(approvedInPeriod, submittedCount)}% of submitted`,
      count: approvedInPeriod,
      pct: pctOf(approvedInPeriod, signups),
      fillClass: styles.funnelFillGood,
    },
    {
      label: 'Started a paid plan',
      sub: `${payers} of ${signups} signups`,
      count: payers,
      pct: signupToPaid,
      fillClass: styles.funnelFillGood,
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
          <Link key={c.key} href={c.href} className={styles.statCard}>
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
          <div className={`${styles.statHint} ${styles.hintGood}`}>{pctChange(signups, signupsPrevCount)} vs last period</div>
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
          <div className={styles.statLabel}>Submitted to paid</div>
          <div className={styles.statNum}>{pctOf(payers, submittedCount)}%</div>
          <div className={styles.statHint}>{payers} paid · {signupToPaid}% of all signups</div>
        </div>
      </div>

      <section className={styles.panel} style={{ marginTop: 20 }}>
        <h3 className={styles.panelTitle}>Signup funnel</h3>
        <p className={styles.panelSub}>Tracks brief sign-ups separately from members who submitted a profile.</p>
        <div className={styles.funnelList}>
          {funnelStages.map((stage) => (
            <div key={stage.label} className={styles.funnelRow}>
              <div className={styles.funnelLabelWrap}>
                <span className={styles.funnelLabel}>{stage.label}</span>
                <span className={styles.funnelSub}>{stage.sub}</span>
              </div>
              <div className={styles.funnelTrack}>
                <div
                  className={`${styles.funnelFill} ${stage.fillClass}`}
                  style={{ width: `${Math.max(stage.count > 0 ? 4 : 0, Math.min(100, stage.pct))}%` }}
                />
              </div>
              <div className={styles.funnelMetric}>
                {stage.count}
                <span className={styles.funnelPct}>({stage.pct}%)</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.twoCol}>
        <section className={styles.panel}>
          <h3 className={styles.panelTitle}>Reviews per day</h3>
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

      <LifecycleSweepCard />
    </div>
  )
}
