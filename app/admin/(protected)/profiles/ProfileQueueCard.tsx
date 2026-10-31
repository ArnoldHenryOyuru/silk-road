'use client'

import { useState } from 'react'
import { approveProfile, rejectProfile } from './actions'
import styles from '../admin.module.css'

export interface PendingProfileCard {
  id: string
  displayName: string
  age: number
  campus: string
  bio: string | null
  lookingFor: string | null
  photoCount: number
  createdAt: string
  thumbUrl: string | null
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function ProfileQueueCard({ profile }: { profile: PendingProfileCard }) {
  const [hidden, setHidden] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handle(action: 'approve' | 'reject') {
    setPending(true)
    setError(null)
    const result = action === 'approve' ? await approveProfile(profile.id) : await rejectProfile(profile.id)
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
      <div className={styles.queueThumb}>
        {profile.thumbUrl ? (
          <img
            src={profile.thumbUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }}
          />
        ) : (
          profile.displayName[0]
        )}
      </div>
      <div className={styles.queueBody}>
        <div className={styles.queueTop}>
          <span className={styles.queueName}>
            {profile.displayName}, {profile.age}
          </span>
          <span className={styles.queueTime}>Submitted {timeAgo(profile.createdAt)}</span>
        </div>
        <div className={styles.queueMeta}>
          {profile.campus} · {profile.lookingFor ?? '—'} · {profile.photoCount} photo
          {profile.photoCount === 1 ? '' : 's'}
        </div>
        {profile.bio && <div className={styles.queueSnippet}>"{profile.bio}"</div>}
        {error && <p className={styles.fieldError}>{error}</p>}
        <div className={styles.queueActions}>
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
