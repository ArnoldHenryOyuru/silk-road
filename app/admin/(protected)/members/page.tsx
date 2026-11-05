import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import styles from '../admin.module.css'

const PAGE_SIZE = 25
const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'approved', label: 'Approved' },
  { value: 'pending_review', label: 'Pending' },
  { value: 'rejected', label: 'Rejected' },
]

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Kampala' })

const statusBadge = (s: string) =>
  s === 'approved' ? styles.badgeGood : s === 'pending_review' ? styles.badgeWarn : s === 'rejected' ? styles.badgeBad : ''

const statusLabel = (s: string) => (s === 'pending_review' ? 'Pending' : s[0].toUpperCase() + s.slice(1))

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  const sp = await searchParams
  // Strip characters that have meaning inside a PostgREST .or() filter
  const q = (sp.q ?? '').trim().replace(/[%,()*]/g, '').slice(0, 60)
  const status = STATUS_FILTERS.some((f) => f.value === sp.status) && sp.status !== 'all' ? sp.status : undefined
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE

  const service = createServiceClient()

  let query = service
    .from('profiles')
    .select('id, user_id, display_name, age, campus, status, face_match_verified, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)
  if (status) query = query.eq('status', status)
  if (q) query = query.or(`display_name.ilike.%${q}%,campus.ilike.%${q}%`)

  const { data: rows, count } = await query
  const members = rows ?? []
  const total = count ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Which of these members currently have an active plan
  const plans = new Map<string, string>()
  if (members.length) {
    const { data: subs } = await service
      .from('subscriptions')
      .select('user_id, plan_type')
      .eq('status', 'active')
      .gt('end_date', new Date().toISOString())
      .in('user_id', members.map((m) => m.user_id))
    for (const s of subs ?? []) plans.set(s.user_id, s.plan_type)
  }

  const href = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const merged = { q, status: sp.status, page: undefined, ...over }
    for (const [k, v] of Object.entries(merged)) if (v && v !== 'all' && !(k === 'page' && v === '1')) p.set(k, v)
    const s = p.toString()
    return `/admin/members${s ? `?${s}` : ''}`
  }

  return (
    <div className={styles.main}>
      <h1 className={styles.pageTitle}>Members</h1>
      <p className={styles.pageSub}>{total} {total === 1 ? 'member' : 'members'}{q || status ? ' match your filters' : ' in total'}.</p>

      <div className={styles.toolbar}>
        <form className={styles.searchForm} action="/admin/members">
          <input className={styles.searchInput} name="q" defaultValue={q} placeholder="Search name or campus" />
          {status && <input type="hidden" name="status" value={status} />}
          <button className={`${styles.btn} ${styles.view}`} type="submit">Search</button>
        </form>
        <div className={styles.pills}>
          {STATUS_FILTERS.map((f) => (
            <Link
              key={f.value}
              href={href({ status: f.value, page: undefined })}
              className={`${styles.pill} ${(status ?? 'all') === f.value ? styles.pillActive : ''}`}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </div>

      <div className={styles.tableWrap}>
        {members.length === 0 ? (
          <div className={styles.emptyState}>No members found.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Member</th>
                <th>Campus</th>
                <th>Status</th>
                <th>Plan</th>
                <th>Verified</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const plan = plans.get(m.user_id)
                return (
                  <tr key={m.id}>
                    <td>
                      <span className={styles.cellName}>{m.display_name}</span>
                      {m.age ? <span className={styles.cellMuted}>, {m.age}</span> : null}
                    </td>
                    <td className={styles.cellMuted}>{m.campus ?? '—'}</td>
                    <td><span className={`${styles.badge} ${statusBadge(m.status)}`}>{statusLabel(m.status)}</span></td>
                    <td>{plan ? <span className={`${styles.badge} ${styles.badgeGood}`}>{plan[0].toUpperCase() + plan.slice(1)}</span> : <span className={styles.cellMuted}>None</span>}</td>
                    <td>{m.face_match_verified ? 'Yes' : <span className={styles.cellMuted}>No</span>}</td>
                    <td className={styles.cellMuted}>{fmtDate(m.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

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
