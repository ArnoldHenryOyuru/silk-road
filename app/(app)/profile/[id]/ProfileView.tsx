'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toggleLike, getContactLink, reportProfile, blockUser } from './actions'
import { initiateCheckout } from '../../subscribe/actions'
import { PLANS, CURRENCY, formatUgx, type PlanId } from '@/lib/payments/plans'
import { paymentProvider } from '@/lib/payments/provider'
import type { MemberStage } from '@/lib/member-stage'
import PhoneField from '../../subscribe/PhoneField'
import EmailVerifyModal from '@/components/EmailVerifyModal'
import ProfilePhoto from '@/components/ProfilePhoto'
import styles from './profile-view.module.css'

export interface ProfileViewData {
  id: string
  displayName: string
  age: number | null
  campus: string | null
  bio: string | null
  lookingFor: string | null
  interests: string[]
  verified: boolean
  isNew: boolean
  photoUrls: string[]
  initials: string
  liked: boolean
}

const REPORT_REASONS = [
  'Fake profile or photos',
  'Harassment or abusive behavior',
  'Inappropriate content',
  'Underage user',
  'Something else',
]

const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)
const ChevronLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)
const ChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)
const VerifiedIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
const HeartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M12 21s-7-4.35-9.5-8.8C1 8.5 2.5 5 6 5c2 0 3.5 1.3 4 2.5C10.5 6.3 12 5 14 5c3.5 0 5 3.5 3.5 7.2C19 16.65 12 21 12 21z" />
  </svg>
)
const MoreIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <circle cx="12" cy="5" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none" />
  </svg>
)
const ReportIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
)
const BlockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="4.9" y1="4.9" x2="19.1" y2="19.1" />
  </svg>
)
const PinIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
)
const TagIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.5 12.5 12.5 20.5a2 2 0 0 1-2.83 0l-6.17-6.17a2 2 0 0 1 0-2.83l8-8A2 2 0 0 1 13 3h6a2 2 0 0 1 2 2v6a2 2 0 0 1-.5 1.5Z" />
    <circle cx="16" cy="8" r="1" />
  </svg>
)
const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
)
const ChatIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
    <path d="M21 11.5a8.5 8.5 0 0 1-12.36 7.56L4 20l1.06-4.42A8.5 8.5 0 1 1 21 11.5Z" />
  </svg>
)
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)
const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
)

export default function ProfileView({
  profile,
  isSubscribed,
  isOwner = false,
  viewerStage = 'approved',
  email = '',
  emailVerified: initialEmailVerified = true,
}: {
  profile: ProfileViewData
  isSubscribed: boolean
  isOwner?: boolean
  viewerStage?: MemberStage
  email?: string
  emailVerified?: boolean
}) {
  const router = useRouter()
  const [current, setCurrent] = useState(0)
  const [liked, setLiked] = useState(profile.liked)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportSent, setReportSent] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [otpOpen, setOtpOpen] = useState(false)
  const [emailVerified, setEmailVerified] = useState(initialEmailVerified)
  const [plan, setPlan] = useState<PlanId>('weekly')
  const [subscribing, setSubscribing] = useState(false)
  const [subscribeError, setSubscribeError] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const subscribed = isSubscribed
  const [contactUrl, setContactUrl] = useState<string | null>(null)
  const [contactRemaining, setContactRemaining] = useState<number | null>(null)
  const [contactNotice, setContactNotice] = useState<string | null>(null)
  const [contactPending, setContactPending] = useState(false)

  const photos = profile.photoUrls.length > 0 ? profile.photoUrls : [null]

  function handleLike() {
    setLiked((v) => !v)
    toggleLike(profile.id).catch(() => setLiked((v) => !v))
  }

  async function handleReport(reason: string) {
    setReportError(null)
    const result = await reportProfile(profile.id, reason)
    if (result && 'error' in result) {
      setReportError("We couldn't send your report. Please try again.")
      return
    }
    setReportSent(true)
    setTimeout(() => setReportOpen(false), 1200)
  }

  async function handleSubscribe() {
    setSubscribeError(null)
    if (!emailVerified) {
      setOtpOpen(true)
      return
    }
    setSubscribing(true)
    const result = await initiateCheckout(plan, phone)
    if ('error' in result) {
      if (result.needsEmailVerification) {
        setOtpOpen(true)
      }
      setSubscribeError(result.error)
      setSubscribing(false)
      return
    }
    if ('redirectUrl' in result) {
      window.location.href = result.redirectUrl
      return
    }
    router.push(`/subscribe/callback?ref=${encodeURIComponent(result.reference)}`)
  }

  async function handleContactClick() {
    setContactNotice(null)
    if (viewerStage === 'draft') {
      setContactNotice('Finish and submit your profile checklist before contacting members.')
      return
    }
    if (viewerStage === 'rejected') {
      setContactNotice('Update and resubmit your profile to restore contacts.')
      return
    }
    if (!subscribed) {
      setModalOpen(true)
      return
    }
    setContactPending(true)
    const result = await getContactLink(profile.id)
    setContactPending(false)
    if (result.ok) {
      setContactUrl(result.url)
      setContactRemaining(result.remaining)
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } else if (result.reason === 'not_subscribed') {
      setModalOpen(true)
    } else if (result.reason === 'rate_limited') {
      setContactNotice(
        `You've used your ${result.limit} contact${result.limit === 1 ? '' : 's'} for today. They reset at midnight.`
      )
    } else if (result.reason === 'profile_not_approved') {
      setContactNotice('Complete and submit your profile checklist before contacting members.')
    } else if (result.reason === 'profile_rejected') {
      setContactNotice('Update and resubmit your profile to restore contacts.')
    } else {
      setContactNotice("We couldn't open this contact right now.")
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.backRow} onClick={() => router.push('/discover')}>
        <BackIcon /> Back to Discover
      </div>

      <div className={styles.gallery}>
        {profile.isNew && <span className={styles.galleryNew}>New</span>}
        {photos.length > 1 && (
          <>
            <button
              className={`${styles.galleryNav} ${styles.prev}`}
              onClick={() => setCurrent((c) => (c - 1 + photos.length) % photos.length)}
              aria-label="Previous photo"
            >
              <ChevronLeft />
            </button>
            <button
              className={`${styles.galleryNav} ${styles.next}`}
              onClick={() => setCurrent((c) => (c + 1) % photos.length)}
              aria-label="Next photo"
            >
              <ChevronRight />
            </button>
          </>
        )}
        {photos.map((url, i) => (
          <div key={i} className={`${styles.gallerySlide} ${i === current ? styles.active : ''}`}>
            <ProfilePhoto
              src={url}
              alt={`${profile.displayName} photo ${i + 1}`}
              initials={profile.initials}
              priority={i === 0}
            />
          </div>
        ))}
        {photos.length > 1 && (
          <div className={styles.galleryDots}>
            {photos.map((_, i) => (
              <button
                key={i}
                className={`${styles.galleryDot} ${i === current ? styles.active : ''}`}
                onClick={() => setCurrent(i)}
                aria-label={`Photo ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className={styles.identityRow}>
        <div className={styles.identityLeft}>
          <h1>
            {profile.displayName}
            {profile.age ? `, ${profile.age}` : ''}
          </h1>
          {profile.verified && (
            <span className={styles.verifiedBadge}>
              <VerifiedIcon />
            </span>
          )}
        </div>
        {!isOwner && (
          <div className={styles.iconActions}>
            <button className={`${styles.iconCircle} ${styles.like}`} data-active={liked} title="Like" onClick={handleLike}>
              <HeartIcon />
            </button>
            <div className={`${styles.iconCircle} ${styles.more}`} title="More options" onClick={() => setOverflowOpen((v) => !v)}>
              <MoreIcon />
              {overflowOpen && (
                <div className={styles.overflowMenu}>
                  <div
                    className={`${styles.overflowItem} ${styles.danger}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setOverflowOpen(false)
                      setReportError(null)
                      setReportOpen(true)
                    }}
                  >
                    <ReportIcon /> Report profile
                  </div>
                  <div
                    className={styles.overflowItem}
                    onClick={(e) => {
                      e.stopPropagation()
                      setOverflowOpen(false)
                      setBlockConfirmOpen(true)
                    }}
                  >
                    <BlockIcon /> Block user
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {profile.campus && (
        <div className={styles.metaRow}>
          <PinIcon /> {profile.campus}
        </div>
      )}

      {photos.length > 1 && (
        <>
          <div className={styles.sectionLabel}>Photos</div>
          <div className={styles.photosStrip}>
            {photos.map((url, i) => (
              <button
                key={i}
                className={`${styles.photoThumb} ${i === current ? styles.active : ''}`}
                onClick={() => setCurrent(i)}
                aria-label={`View photo ${i + 1}`}
              >
                <ProfilePhoto
                  src={url}
                  alt={`${profile.displayName} thumbnail ${i + 1}`}
                  initials={profile.initials}
                />
              </button>
            ))}
          </div>
        </>
      )}

      {(profile.lookingFor || profile.interests.length > 0) && (
        <div className={styles.tagRow}>
          {profile.lookingFor && (
            <span className={styles.pill}>
              <TagIcon /> {profile.lookingFor}
            </span>
          )}
          {profile.interests.map((tag) => (
            <span key={tag} className={`${styles.pill} ${styles.neutral}`}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {profile.bio && (
        <>
          <div className={styles.sectionLabel}>About</div>
          <p className={styles.bioText}>{profile.bio}</p>
        </>
      )}

      <div className={styles.contactCard}>
        {isOwner ? (
          <button className={styles.contactBtn} onClick={() => router.push('/profile/edit')}>
            <EditIcon /> Edit Profile
          </button>
        ) : viewerStage === 'draft' ? (
          <Link href="/onboarding/profile" className={styles.contactBtn} style={{ textDecoration: 'none' }}>
            <LockIcon /> Finish checklist to contact
          </Link>
        ) : viewerStage === 'rejected' ? (
          <Link href="/pending-review" className={styles.contactBtn} style={{ textDecoration: 'none' }}>
            <LockIcon /> Resubmit profile to contact
          </Link>
        ) : subscribed ? (
          <>
            <button className={styles.contactBtn} onClick={handleContactClick} disabled={contactPending}>
              <ChatIcon /> {contactPending ? 'Loading…' : 'Contact via WhatsApp'}
            </button>
            {contactUrl && (
              <p className={styles.contactNote}>
                Opens WhatsApp in a new tab.
                {contactRemaining === 0 && ' That was your last contact for today; they reset at midnight.'}
              </p>
            )}
            {contactNotice && (
              <p className={styles.contactNote} style={{ color: 'var(--danger)' }}>
                {contactNotice}
              </p>
            )}
          </>
        ) : (
          <button className={styles.contactBtn} onClick={() => setModalOpen(true)}>
            <LockIcon /> Subscribe to contact
          </button>
        )}
      </div>

      {!isOwner && (
        <div className={styles.reportRow} onClick={() => setReportOpen(true)}>
          <ReportIcon /> Report this profile
        </div>
      )}

      {/* Subscribe modal */}
      <div className={`${styles.modalOverlay} ${modalOpen ? styles.open : ''}`} onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
        <div className={styles.modalCard}>
          <div className={styles.modalTop}>
            <div>
              <div className={styles.modalTitle}>Subscribe to Silk Road</div>
              <div className={styles.modalSub}>Unlock contact on every profile you view</div>
            </div>
            <button className={styles.modalClose} onClick={() => setModalOpen(false)}>
              <CloseIcon />
            </button>
          </div>

          <div className={styles.benefitList}>
            {['Contact anyone via WhatsApp', `Up to ${PLANS.weekly.dailyContacts} new contacts a day (${PLANS.monthly.dailyContacts} on Monthly)`, 'Free account deletion, anytime'].map((b) => (
              <div key={b} className={styles.benefitItem}>
                <span className={styles.benefitCheck}>
                  <CheckIcon />
                </span>
                {b}
              </div>
            ))}
          </div>

          <div className={styles.planToggle}>
            <div className={`${styles.planOption} ${plan === 'weekly' ? styles.selected : ''}`} onClick={() => setPlan('weekly')}>
              <div className={styles.planName}>Weekly</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>{PLANS.weekly.dailyContacts} contacts a day</div>
              <div className={styles.planPrice}>
                {formatUgx(PLANS.weekly.amount)} <span>{CURRENCY}</span>
              </div>
            </div>
            <div className={`${styles.planOption} ${plan === 'monthly' ? styles.selected : ''}`} onClick={() => setPlan('monthly')}>
              <span className={styles.planBadge}>BEST VALUE</span>
              <div className={styles.planName}>Monthly</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>{PLANS.monthly.dailyContacts} contacts a day</div>
              <div className={styles.planPrice}>
                {formatUgx(PLANS.monthly.amount)} <span>{CURRENCY}</span>
              </div>
            </div>
          </div>

          {paymentProvider === 'nylon' && <PhoneField value={phone} onChange={setPhone} disabled={subscribing} />}

          {subscribeError && (
            <p className={styles.modalFine} style={{ color: 'var(--danger)' }}>
              {subscribeError}
            </p>
          )}

          <button className={styles.modalCta} onClick={handleSubscribe} disabled={subscribing}>
            {subscribing
              ? paymentProvider === 'nylon'
                ? 'Sending prompt…'
                : 'Taking you to payment…'
              : `Subscribe — ${formatUgx(PLANS[plan].amount)} ${CURRENCY}`}
          </button>
          <div className={styles.modalFine}>
            {paymentProvider === 'nylon'
              ? "We'll send an approval prompt to your phone. "
              : "You'll choose MTN MoMo or Airtel Money on the secure payment page. "}
            One-time payment: your plan doesn&apos;t renew automatically.
          </div>
        </div>
      </div>

      {/* Report modal */}
      {reportOpen && (
        <div className={styles.reportModalOverlay} onClick={(e) => e.target === e.currentTarget && setReportOpen(false)}>
          <div className={styles.reportModalCard}>
            {reportSent ? (
              <p>Thanks — we&apos;ll take a look.</p>
            ) : (
              <>
                <div className={styles.modalTitle}>Report this profile</div>
                <div className={styles.modalSub}>Why are you reporting {profile.displayName}?</div>
                {reportError && (
                  <p className={styles.modalFine} style={{ color: 'var(--danger)', textAlign: 'left' }}>
                    {reportError}
                  </p>
                )}
                {REPORT_REASONS.map((reason) => (
                  <div key={reason} className={styles.reportOption} onClick={() => handleReport(reason)}>
                    {reason}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Block confirmation modal */}
      {blockConfirmOpen && (
        <div className={styles.reportModalOverlay} onClick={(e) => e.target === e.currentTarget && setBlockConfirmOpen(false)}>
          <div className={styles.reportModalCard}>
            <div className={styles.modalTitle}>Block {profile.displayName}?</div>
            <div className={styles.modalSub}>You won&apos;t see each other on Silk Road anymore.</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button
                type="button"
                className={styles.modalCta}
                style={{ marginTop: 0, height: 42, background: 'var(--danger)' }}
                onClick={() => blockUser(profile.id)}
              >
                Block user
              </button>
              <button
                type="button"
                className={styles.modalCta}
                style={{
                  marginTop: 0,
                  height: 42,
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                }}
                onClick={() => setBlockConfirmOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <EmailVerifyModal
        open={otpOpen}
        email={email}
        onClose={() => setOtpOpen(false)}
        onVerified={() => {
          setEmailVerified(true)
          setOtpOpen(false)
          setSubscribeError(null)
        }}
      />
    </main>
  )
}
