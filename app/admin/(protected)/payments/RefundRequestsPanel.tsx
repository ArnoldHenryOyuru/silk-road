'use client'

import { useState } from 'react'
import { formatUgx } from '@/lib/payments/plans'
import { processRefundRequest, type AdminRefundRequestRow } from './actions'
import styles from '../admin.module.css'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Kampala',
  })
}

export default function RefundRequestsPanel({
  initialRequests,
}: {
  initialRequests: AdminRefundRequestRow[]
}) {
  const [rows, setRows] = useState<AdminRefundRequestRow[]>(initialRequests)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [payoutRef, setPayoutRef] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  function openRefundForm(id: string) {
    setError(null)
    setEditingId(id)
    setPayoutRef('')
    setAdminNote('')
  }

  function closeRefundForm() {
    setEditingId(null)
    setPayoutRef('')
    setAdminNote('')
  }

  async function handleDecision(
    id: string,
    decision: 'refunded' | 'declined',
    metadata?: { payoutRef?: string; adminNote?: string }
  ) {
    setBusyId(id)
    setError(null)
    const res = await processRefundRequest(id, decision, metadata)
    setBusyId(null)
    if (res.error) {
      setError(res.error)
      return
    }
    if (res.status) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: res.status!,
                payoutRef: res.payoutRef ?? null,
                adminNote: res.adminNote ?? null,
                reviewedAt: res.reviewedAt ?? r.reviewedAt,
              }
            : r
        )
      )
      closeRefundForm()
    }
  }

  const pendingCount = rows.filter((r) => r.status === 'pending').length

  return (
    <section className={styles.panel} style={{ marginBottom: 24 }}>
      <h2 className={styles.panelTitle}>
        Refund requests{pendingCount > 0 ? ` (${pendingCount} pending)` : ''}
      </h2>
      <p className={styles.panelSub}>
        Submitted by rejected paying members within their 14-day recovery window.
      </p>

      {error && <p className={styles.fieldError}>{error}</p>}

      {rows.length === 0 ? (
        <p className={styles.tableNote}>No refund requests yet.</p>
      ) : (
        <div className={styles.tableWrap} style={{ marginTop: 14 }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Member</th>
                <th>Amount</th>
                <th>Reason &amp; notes</th>
                <th>Requested</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isPending = r.status === 'pending'
                const isEditing = editingId === r.id
                const badgeClass =
                  r.status === 'refunded'
                    ? styles.badgeGood
                    : r.status === 'declined'
                      ? styles.badgeBad
                      : styles.badgeWarn
                const label =
                  r.status === 'refunded'
                    ? 'Refunded'
                    : r.status === 'declined'
                      ? 'Declined'
                      : 'Pending'
                return (
                  <tr key={r.id}>
                    <td className={styles.cellName}>{r.memberName}</td>
                    <td>
                      {r.currency} {formatUgx(r.amount)}
                    </td>
                    <td className={styles.cellMuted} style={{ maxWidth: 280 }}>
                      <div>{r.reason}</div>
                      {r.payoutRef && (
                        <div style={{ fontSize: 11.5, marginTop: 4, color: 'var(--text-primary)' }}>
                          Payout ref: <strong>{r.payoutRef}</strong>
                        </div>
                      )}
                      {r.adminNote && (
                        <div style={{ fontSize: 11.5, marginTop: 2 }}>
                          Note: {r.adminNote}
                        </div>
                      )}
                    </td>
                    <td className={styles.cellMuted}>{fmtDate(r.createdAt)}</td>
                    <td>
                      <span className={`${styles.badge} ${badgeClass}`}>{label}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {isPending ? (
                        isEditing ? (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6,
                              alignItems: 'flex-end',
                              minWidth: 220,
                            }}
                          >
                            <input
                              type="text"
                              value={payoutRef}
                              onChange={(e) => setPayoutRef(e.target.value)}
                              placeholder="Payout ref (optional)"
                              maxLength={120}
                              style={{
                                width: '100%',
                                padding: '6px 10px',
                                borderRadius: 8,
                                border: '1px solid var(--border)',
                                background: 'var(--bg)',
                                color: 'var(--text-primary)',
                                fontSize: 12,
                              }}
                            />
                            <input
                              type="text"
                              value={adminNote}
                              onChange={(e) => setAdminNote(e.target.value)}
                              placeholder="Internal note (optional)"
                              maxLength={300}
                              style={{
                                width: '100%',
                                padding: '6px 10px',
                                borderRadius: 8,
                                border: '1px solid var(--border)',
                                background: 'var(--bg)',
                                color: 'var(--text-primary)',
                                fontSize: 12,
                              }}
                            />
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button
                                type="button"
                                className={`${styles.btn} ${styles.approve}`}
                                onClick={() =>
                                  handleDecision(r.id, 'refunded', { payoutRef, adminNote })
                                }
                                disabled={busyId === r.id}
                              >
                                {busyId === r.id ? 'Saving…' : 'Confirm refund'}
                              </button>
                              <button
                                type="button"
                                className={`${styles.btn} ${styles.view}`}
                                onClick={closeRefundForm}
                                disabled={busyId === r.id}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              type="button"
                              className={`${styles.btn} ${styles.approve}`}
                              onClick={() => openRefundForm(r.id)}
                              disabled={busyId === r.id}
                            >
                              Mark refunded
                            </button>
                            <button
                              type="button"
                              className={`${styles.btn} ${styles.reject}`}
                              onClick={() => handleDecision(r.id, 'declined')}
                              disabled={busyId === r.id}
                            >
                              Decline
                            </button>
                          </div>
                        )
                      ) : (
                        <span className={styles.cellMuted}>
                          {r.reviewedAt ? `Resolved ${fmtDate(r.reviewedAt)}` : 'Resolved'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
