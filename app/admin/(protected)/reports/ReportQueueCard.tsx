'use client'

import { useState } from 'react'
import { dismissReport, suspendReportedUser } from './actions'
import styles from '../admin.module.css'

export interface ReportCard {
  id: string
  reason: string
  reporterName: string
  reportedName: string
  createdAt: string
}

function timeAgo(iso: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function ReportQueueCard({ report }: { report: ReportCard }) {
  const [hidden, setHidden] = useState(false)
  const [pending, setPending] = useState(false)
  const [confirmSuspend, setConfirmSuspend] = useState(false)
  const [blockNumber, setBlockNumber] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function handle(action: 'dismiss' | 'suspend') {
    setPending(true)
    setError(null)
    const result =
      action === 'dismiss'
        ? await dismissReport(report.id)
        : await suspendReportedUser(report.id, blockNumber)
    setPending(false)
    if (result?.error) {
      setError(result.error)
      return
    }
    setHidden(true)
  }

  if (hidden) return null

  return (
    <div className={styles.queueCard}>
      <div className={styles.queueBody}>
        <span className={styles.reportReason}>{report.reason}</span>
        <div className={styles.reportParties}>
          <strong>{report.reporterName}</strong> reported <strong>{report.reportedName}</strong> ·{' '}
          {timeAgo(report.createdAt)}
        </div>
        {error && <p className={styles.fieldError}>{error}</p>}
        {confirmSuspend ? (
          <div className={styles.confirmBox}>
            <p className={styles.confirmText}>
              Suspend {report.reportedName}&apos;s account and pause any active plan?
            </p>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={blockNumber}
                onChange={(e) => setBlockNumber(e.target.checked)}
                disabled={pending}
              />
              Also blocklist their WhatsApp number so they cannot re-register
            </label>
            <div className={styles.queueActions} style={{ marginTop: 2 }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.reject}`}
                onClick={() => handle('suspend')}
                disabled={pending}
              >
                {pending ? 'Suspending…' : 'Confirm suspend'}
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.view}`}
                onClick={() => setConfirmSuspend(false)}
                disabled={pending}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.queueActions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.reject}`}
              onClick={() => setConfirmSuspend(true)}
              disabled={pending}
            >
              Suspend user
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.view}`}
              onClick={() => handle('dismiss')}
              disabled={pending}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
