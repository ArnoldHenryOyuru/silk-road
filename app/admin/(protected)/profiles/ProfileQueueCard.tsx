'use client'

import { useState } from 'react'
import { approveProfile, rejectProfile } from './actions'
import styles from '../admin.module.css'

export interface PendingProfileCard {
  id: string
  displayName: string
  age: number | null
  campus: string | null
  bio: string | null
  lookingFor: string | null
  photoCount: number
  createdAt: string
  thumbUrl: string | null
  isPaid: boolean
  planType: string | null
  isReported: boolean
}

function timeAgo(iso: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function ProfileQueueCard({ profile }: { profile: PendingProfileCard }) {
  const [hidden, setHidden] = useState(false)
  const [pending, setPending] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleApprove() {
    setPending(true)
    setError(null)
    const result = await approveProfile(profile.id)
    setPending(false)
    if (result?.error) {
      setError(result.error)
      return
    }
    setHidden(true)
  }

  async function handleReject() {
    setPending(true)
    setError(null)
    const result = await rejectProfile(profile.id, reason)
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className={styles.queueName}>
              {profile.displayName}
              {profile.age ? `, ${profile.age}` : ''}
            </span>
            {profile.isPaid && (
              <span className={`${styles.badge} ${styles.badgeWarn}`}>
                Paid ({profile.planType ?? 'plan'}) · Priority
              </span>
            )}
            {profile.isReported && (
              <span className={`${styles.badge} ${styles.badgeBad}`}>Reported</span>
            )}
          </div>
          <span className={styles.queueTime}>Submitted {timeAgo(profile.createdAt)}</span>
        </div>
        <div className={styles.queueMeta}>
          {profile.campus ?? '—'} · {profile.lookingFor ?? '—'} · {profile.photoCount} photo
          {profile.photoCount === 1 ? '' : 's'}
        </div>
        {profile.bio && <div className={styles.queueSnippet}>&ldquo;{profile.bio}&rdquo;</div>}
        {error && <p className={styles.fieldError}>{error}</p>}

        {rejecting ? (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="text"
              className={styles.searchInput}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional reason for member (e.g. blurry main photo)"
              maxLength={300}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.reject}`}
                onClick={handleReject}
                disabled={pending}
              >
                {pending ? 'Rejecting…' : 'Confirm reject'}
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.view}`}
                onClick={() => setRejecting(false)}
                disabled={pending}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.queueActions}>
            <button className={`${styles.btn} ${styles.approve}`} onClick={handleApprove} disabled={pending}>
              Approve
            </button>
            <button className={`${styles.btn} ${styles.reject}`} onClick={() => setRejecting(true)} disabled={pending}>
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
