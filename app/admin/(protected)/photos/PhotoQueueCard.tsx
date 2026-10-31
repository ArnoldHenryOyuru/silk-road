'use client'

import { useState } from 'react'
import { approvePhoto, rejectPhoto } from './actions'
import styles from '../admin.module.css'

export interface PendingPhotoCard {
  id: string
  url: string
  displayName: string
  age: number
  isPrimary: boolean
}

export default function PhotoQueueCard({ photo }: { photo: PendingPhotoCard }) {
  const [hidden, setHidden] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handle(action: 'approve' | 'reject') {
    setPending(true)
    setError(null)
    const result = action === 'approve' ? await approvePhoto(photo.id) : await rejectPhoto(photo.id)
    setPending(false)
    if (result?.error) {
      setError(result.error)
      return
    }
    setHidden(true)
  }

  if (hidden) return null

  return (
    <div className={styles.photoCard}>
      <img src={photo.url} alt="" />
      <div className={styles.photoCardBody}>
        <div className={styles.photoCardName}>
          {photo.displayName}, {photo.age}
          {photo.isPrimary && ' · main photo'}
        </div>
        {error && <p className={styles.fieldError}>{error}</p>}
        <div className={styles.photoCardActions}>
          <button className={`${styles.btn} ${styles.approve}`} onClick={() => handle('approve')} disabled={pending}>
            Approve
          </button>
          <button className={`${styles.btn} ${styles.reject}`} onClick={() => handle('reject')} disabled={pending}>
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}
