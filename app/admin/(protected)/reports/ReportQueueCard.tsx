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
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function ReportQueueCard({ report }: { report: ReportCard }) {
  const [hidden, setHidden] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handle(action: 'dismiss' | 'suspend') {
    if (action === 'suspend' && !confirm(`Suspend ${report.reportedName}'s account?`)) return

    setPending(true)
    setError(null)
    const result = action === 'dismiss' ? await dismissReport(report.id) : await suspendReportedUser(report.id)
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
        <div className={styles.queueActions}>
          <button className={`${styles.btn} ${styles.reject}`} onClick={() => handle('suspend')} disabled={pending}>
            Suspend user
          </button>
          <button className={`${styles.btn} ${styles.view}`} onClick={() => handle('dismiss')} disabled={pending}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
