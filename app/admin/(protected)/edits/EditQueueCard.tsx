'use client'

import { useState } from 'react'
import { approveEdit, rejectEdit } from './actions'
import styles from '../admin.module.css'

export interface PendingEditCard {
  id: string
  displayName: string
  age: number
  oldValue: string | null
  newValue: string | null
}

export default function EditQueueCard({ edit }: { edit: PendingEditCard }) {
  const [hidden, setHidden] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handle(action: 'approve' | 'reject') {
    setPending(true)
    setError(null)
    const result = action === 'approve' ? await approveEdit(edit.id) : await rejectEdit(edit.id)
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
        <div className={styles.queueTop}>
          <span className={styles.queueName}>
            {edit.displayName}, {edit.age}
          </span>
        </div>
        <div className={styles.queueSnippet}>
          <span className={styles.diffOld}>{edit.oldValue || '(empty)'}</span>
          <br />
          <span className={styles.diffNew}>{edit.newValue || '(empty)'}</span>
        </div>
        {error && <p className={styles.fieldError}>{error}</p>}
        <div className={styles.queueActions}>
          <button className={`${styles.btn} ${styles.approve}`} onClick={() => handle('approve')} disabled={pending}>
            Approve
          </button>
          <button className={`${styles.btn} ${styles.reject}`} onClick={() => handle('reject')} disabled={pending}>
            Reject &amp; revert
          </button>
        </div>
      </div>
    </div>
  )
}
