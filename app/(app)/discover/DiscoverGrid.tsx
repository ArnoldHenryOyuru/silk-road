'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { DiscoverProfile } from '@/types/discover'
import { toggleLike, getContactLink } from './actions'
import styles from './discover.module.css'

const GRADIENTS = [
  'linear-gradient(135deg,#8A72FF,#6C4FF6)',
  'linear-gradient(135deg,#FF9A7F,#FF6B57)',
  'linear-gradient(135deg,#5B9DFF,#2F80ED)',
  'linear-gradient(135deg,#B98CFF,#6C4FF6)',
  'linear-gradient(135deg,#FFB199,#FF6B57)',
  'linear-gradient(135deg,#7FD6FF,#2F80ED)',
  'linear-gradient(135deg,#A78BFA,#6C4FF6)',
  'linear-gradient(135deg,#FF8A75,#FF6B57)',
]

function VerifiedBadge() {
  return (
    <span className={styles.verifiedBadge}>
      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  )
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 21s-7-4.35-9.5-8.8C1 8.5 2.5 5 6 5c2 0 3.5 1.3 4 2.5C10.5 6.3 12 5 14 5c3.5 0 5 3.5 3.5 7.2C19 16.65 12 21 12 21z" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 11.5a8.4 8.4 0 0 1-8.4 8.4A8.3 8.3 0 0 1 8.5 19L3 20l1.1-4.4A8.3 8.3 0 0 1 3.6 11.5 8.4 8.4 0 0 1 21 11.5Z" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.5 12.5 12.5 20.5a2 2 0 0 1-2.83 0l-6.17-6.17a2 2 0 0 1 0-2.83l8-8A2 2 0 0 1 13 3h6a2 2 0 0 1 2 2v6a2 2 0 0 1-.5 1.5Z" />
      <circle cx="16" cy="8" r="1" />
    </svg>
  )
}

export default function DiscoverGrid({
  profiles,
  isSubscribed,
  contactLimit,
}: {
  profiles: DiscoverProfile[]
  isSubscribed: boolean
  contactLimit: number
}) {
  const router = useRouter()
  const [likedState, setLikedState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(profiles.map((p) => [p.id, p.liked]))
  )
  const [, startTransition] = useTransition()
  const [pendingContact, setPendingContact] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Messages (limit reached, etc.) disappear on their own.
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(timer)
  }, [notice])

  function handleLike(profileId: string) {
    setLikedState((prev) => ({ ...prev, [profileId]: !prev[profileId] }))
    startTransition(() => {
      toggleLike(profileId).catch(() => {
        // Revert the optimistic update if the write failed.
        setLikedState((prev) => ({ ...prev, [profileId]: !prev[profileId] }))
      })
    })
  }

  async function handleContact(profileId: string) {
    if (!isSubscribed) {
      router.push(`/profile/${profileId}`)
      return
    }
    setPendingContact(profileId)
    try {
      const result = await getContactLink(profileId)
      if (result.ok) {
        window.open(result.url, '_blank', 'noopener,noreferrer')
        if (result.remaining === 0) {
          setNotice('That was your last contact for today. Your contacts reset at midnight.')
        }
      } else if (result.reason === 'not_subscribed') {
        router.push(`/profile/${profileId}`)
      } else if (result.reason === 'rate_limited') {
        const limit = result.limit || contactLimit
        setNotice(`You've used your ${limit} contact${limit === 1 ? '' : 's'} for today. They reset at midnight.`)
      } else if (result.reason === 'profile_not_approved') {
        setNotice('Complete and submit your profile checklist before contacting members.')
      } else if (result.reason === 'profile_rejected') {
        setNotice('Update and resubmit your profile to restore contacts.')
      } else {
        setNotice("We couldn't open this contact right now.")
      }
    } finally {
      setPendingContact(null)
    }
  }

  return (
    <>
    <div className={styles.grid}>
      {profiles.map((p, i) => (
        <div
          className={styles.card}
          key={p.id}
          onClick={() => router.push(`/profile/${p.id}`)}
          role="button"
          tabIndex={0}
        >
          <div
            className={styles.cardPhoto}
            style={{
              background: p.photoUrl ? `url(${p.photoUrl}) center/cover` : GRADIENTS[i % GRADIENTS.length],
            }}
          >
            {p.isNew && <span className={styles.tagNew}>New</span>}
            {!p.photoUrl && p.initials}
          </div>

          <div className={styles.cardBody}>
            <div className={styles.cardTopRow}>
              <div className={styles.cardNameRow}>
                <span className={styles.nameText}>
                  {p.displayName} {p.age}
                </span>
                {p.verified && (
                  <>
                    <span className={styles.dot}>•</span>
                    <VerifiedBadge />
                  </>
                )}
              </div>

              <div className={styles.iconActions}>
                <button
                  type="button"
                  className={`${styles.iconCircle} ${styles.like}`}
                  data-active={likedState[p.id]}
                  title="Like"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleLike(p.id)
                  }}
                >
                  <HeartIcon />
                </button>
                <button
                  type="button"
                  className={`${styles.iconCircle} ${isSubscribed ? styles.contact : styles.locked}`}
                  title={isSubscribed ? 'Contact via WhatsApp' : 'Subscribe to contact'}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleContact(p.id)
                  }}
                  disabled={pendingContact === p.id}
                >
                  {isSubscribed ? <ChatIcon /> : <LockIcon />}
                </button>
              </div>
            </div>

            <div className={styles.cardMeta}>
              <PinIcon /> {p.campus}
            </div>
            {p.lookingFor && (
              <div className={styles.cardTagRow}>
                <TagIcon /> {p.lookingFor}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
    {notice && (
      <div className={styles.toast} role="status">
        {notice}
      </div>
    )}
    </>
  )
}
