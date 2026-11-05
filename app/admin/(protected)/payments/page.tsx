import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import { PLANS, isPlanId, formatUgx } from '@/lib/payments/plans'
import styles from '../admin.module.css'

const PAGE_SIZE = 25
const DAY = 86_400_000
const PLAN_FILTERS = [
  { value: 'all', label: 'All plans' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Kampala' })

const money = (n: number) => (n >= 1_000_000 ? `UGX ${(n / 1_000_000).toFixed(1)}M` : `UGX ${formatUgx(n)}`)
const price = (t?: string | null) => (isPlanId(t) ? PLANS[t].amount : 0)
const cap = (t: string) => t[0].toUpperCase() + t.slice(1)

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; page?: string }>
}) {
  const sp = await searchParams
  const plan = isPlanId(sp.plan) ? sp.plan : undefined
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE

  const service = createServiceClient()
  const now = new Date()
  const nowIso = now.toISOString()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const soon = new Date(now.getTime() + 3 * DAY).toISOString()

  // Revenue is estimated: number of plans started x the price in lib/plans.ts
  const revenueSince = async (since?: string) => {
    const count = (p: 'weekly' | 'monthly') => {
      let b = service.from('subscriptions').select('id', { count: 'exact', head: true }).eq('plan_type', p)
      if (since) b = b.gte('start_date', since)
      return b
    }
    const [w, m] = await Promise.all([count('weekly'), count('monthly')])
    return (w.count ?? 0) * PLANS.weekly.amount + (m.count ?? 0) * PLANS.monthly.amount
  }

  let listQuery = service
    .from('subscriptions')
    .select('id, user_id, plan_type, start_date, end_date, payment_ref, status', { count: 'exact' })
    .order('start_date', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)
  if (plan) listQuery = listQuery.eq('plan_type', plan)

  const [allTime, thisMonth, active, expiring, list] = await Promise.all([
    revenueSince(),
    revenueSince(monthStart),
    service.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active').gt('end_date', nowIso),
    service.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active').gt('end_date', nowIso).lt('end_date', soon),
    listQuery,
  ])

  const rows = list.data ?? []
  const total = list.count ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const names = new Map<string, string>()
  if (rows.length) {
    const { data: profs } = await service
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', [...new Set(rows.map((r) => r.user_id))])
    for (const p of profs ?? []) names.set(p.user_id, p.display_name)
  }

  const href = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const merged = { plan: sp.plan, page: undefined, ...over }
    for (const [k, v] of Object.entries(merged)) if (v && v !== 'all' && !(k === 'page' && v === '1')) p.set(k, v)
    const s = p.toString()
    return `/admin/payments${s ? `?${s}` : ''}`
  }

  const cards = [
    { label: 'Revenue this month', value: money(thisMonth), hint: 'estimated from plans started' },
    { label: 'Revenue all time', value: money(allTime), hint: 'estimated from plans started' },
    { label: 'Active subscribers', value: String(active.count ?? 0), hint: 'plans not yet expired' },
    { label: 'Expiring in 3 days', value: String(expiring.count ?? 0), hint: 'may renew soon' },
  ]

  return (
    <div className={styles.main}>
      <h1 className={styles.pageTitle}>Payments</h1>
      <p className={styles.pageSub}>Every plan purchase, newest first.</p>

      <div className={styles.statGrid} style={{ marginBottom: 24 }}>
        {cards.map((c) => (
          <div key={c.label} className={styles.statCard}>
            <div className={styles.statLabel}>{c.label}</div>
            <div className={styles.statNum}>{c.value}</div>
            <div className={styles.statHint}>{c.hint}</div>
          </div>
        ))}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.pills}>
          {PLAN_FILTERS.map((f) => (
            <Link
              key={f.value}
              href={href({ plan: f.value, page: undefined })}
              className={`${styles.pill} ${(plan ?? 'all') === f.value ? styles.pillActive : ''}`}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </div>

      <div className={styles.tableWrap}>
        {rows.length === 0 ? (
          <div className={styles.emptyState}>No payments yet.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Member</th>
                <th>Plan</th>
                <th>Amount</th>
                <th>Reference</th>
                <th>Paid</th>
                <th>Expires</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const cancelled = r.status === 'cancelled'
                const live = r.status === 'active' && new Date(r.end_date) > now
                return (
                  <tr key={r.id}>
                    <td className={styles.cellName}>{names.get(r.user_id) ?? 'Unknown'}</td>
                    <td>{cap(r.plan_type)}</td>
                    <td>UGX {formatUgx(price(r.plan_type))}</td>
                    <td className={styles.cellMuted}>{r.payment_ref ?? '—'}</td>
                    <td className={styles.cellMuted}>{fmtDate(r.start_date)}</td>
                    <td className={styles.cellMuted}>{fmtDate(r.end_date)}</td>
                    <td>
                      <span className={`${styles.badge} ${live ? styles.badgeGood : cancelled ? styles.badgeBad : ''}`}>
                        {cancelled ? 'Cancelled' : live ? 'Active' : 'Expired'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className={styles.tableNote}>Amounts come from the prices in lib/plans.ts, not from Pesapal receipts.</p>

      <div className={styles.pager}>
        <span>Page {page} of {pages}</span>
        <div className={styles.pagerBtns}>
          {page > 1 && <Link className={`${styles.btn} ${styles.view}`} href={href({ page: String(page - 1) })}>Previous</Link>}
          {page < pages && <Link className={`${styles.btn} ${styles.view}`} href={href({ page: String(page + 1) })}>Next</Link>}
        </div>
      </div>
    </div>
  )
}
