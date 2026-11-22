'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { initiateCheckout } from './actions'
import PhoneField from './PhoneField'
import EmailVerifyModal from '@/components/EmailVerifyModal'
import { PLANS, CURRENCY, formatUgx, type PlanId } from '@/lib/payments/plans'
import { paymentProvider } from '@/lib/payments/provider'
import type { MemberStage } from '@/lib/member-stage'
import styles from './subscribe.module.css'

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function SubscribeView({
  isSubscribed,
  endDate,
  defaultPhone = null,
  stage = 'approved',
  email = '',
  emailVerified: initialEmailVerified = true,
  hasPausedSubscription = false,
}: {
  isSubscribed: boolean
  endDate: string | null
  defaultPhone?: string | null
  stage?: MemberStage
  email?: string
  emailVerified?: boolean
  hasPausedSubscription?: boolean
}) {
  const router = useRouter()
  const [plan, setPlan] = useState<PlanId>('weekly')
  const [phone, setPhone] = useState(defaultPhone ?? '')
  const [subscribing, setSubscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailVerified, setEmailVerified] = useState(initialEmailVerified)
  const [otpOpen, setOtpOpen] = useState(false)

  async function handleSubscribe() {
    setError(null)
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
      setError(result.error)
      setSubscribing(false)
      return
    }
    if ('redirectUrl' in result) {
      window.location.href = result.redirectUrl
      return
    }
    router.push(`/subscribe/callback?ref=${encodeURIComponent(result.reference)}`)
  }

  return (
    <main className={styles.main}>
      <h1>Subscribe</h1>
      <p className={styles.subtitle}>Unlock contact on every profile you view across Silk Road.</p>

      {isSubscribed ? (
        <>
          <div className={`${styles.statusCard} ${styles.active}`}>
            <div className={styles.statusLabel}>Status</div>
            <div className={`${styles.statusValue} ${styles.active}`}>
              Active{endDate ? ` · until ${formatDate(endDate)}` : ''}
            </div>
            <div className={styles.statusNote}>
              {stage === 'pending_review'
                ? 'Your profile is in review: you have 1 contact a day right now, and your full plan allowance unlocks as soon as you are approved.'
                : 'You can contact anyone on Discover until then.'}
            </div>
          </div>
          <button className={styles.secondaryBtn} onClick={() => router.push('/discover')}>
            Browse Discover
          </button>
        </>
      ) : hasPausedSubscription ? (
        <>
          <div className={`${styles.statusCard} ${styles.inactive}`}>
            <div className={styles.statusLabel}>Plan paused</div>
            <div className={`${styles.statusValue} ${styles.inactive}`}>Waiting on profile updates</div>
            <div className={styles.statusNote}>
              Your plan was paused when your profile needed changes. Resubmit your profile to resume it, or request a refund within 14 days.
            </div>
          </div>
          <Link href="/pending-review" className={styles.secondaryBtn}>
            Manage status &amp; plan
          </Link>
        </>
      ) : stage === 'draft' ? (
        <>
          <div className={`${styles.statusCard} ${styles.inactive}`}>
            <div className={styles.statusLabel}>Complete profile first</div>
            <div className={`${styles.statusValue} ${styles.inactive}`}>Profile checklist unfinished</div>
            <div className={styles.statusNote}>
              Finish and submit your profile checklist first. Once submitted, you can subscribe right away and contact up to 1 person a day while in review.
            </div>
          </div>
          <Link href="/onboarding/profile" className={styles.secondaryBtn}>
            Go to profile checklist
          </Link>
        </>
      ) : stage === 'rejected' ? (
        <>
          <div className={`${styles.statusCard} ${styles.inactive}`}>
            <div className={styles.statusLabel}>Profile needs updates</div>
            <div className={`${styles.statusValue} ${styles.inactive}`}>Resubmit before subscribing</div>
            <div className={styles.statusNote}>
              Update your profile and resubmit it for review before starting a subscription.
            </div>
          </div>
          <Link href="/pending-review" className={styles.secondaryBtn}>
            Review rejection details
          </Link>
        </>
      ) : (
        <>
          <div className={`${styles.statusCard} ${styles.inactive}`}>
            <div className={styles.statusLabel}>Status</div>
            <div className={`${styles.statusValue} ${styles.inactive}`}>
              {stage === 'pending_review' ? 'Pending review · Ready to subscribe' : 'Not subscribed'}
            </div>
            {stage === 'pending_review' && (
              <div className={styles.statusNote}>
                Subscribing while in review unlocks 1 contact/day immediately, expanding to your full plan limit once approved.
              </div>
            )}
          </div>

          {!emailVerified && (
            <div className={`${styles.statusCard} ${styles.inactive}`} style={{ marginBottom: 18 }}>
              <div className={styles.statusLabel}>Email verification required</div>
              <div className={styles.statusNote} style={{ marginTop: 4 }}>
                Verify your email ({email}) with a 6-digit code before checking out.
              </div>
              <button type="button" className={styles.secondaryBtn} onClick={() => setOtpOpen(true)}>
                Verify email now
              </button>
            </div>
          )}

          <div className={styles.benefitList}>
            {[
              'Contact anyone via WhatsApp',
              stage === 'pending_review'
                ? `1 contact/day while in review (${PLANS.weekly.dailyContacts}/day Weekly or ${PLANS.monthly.dailyContacts}/day Monthly after approval)`
                : `Up to ${PLANS.weekly.dailyContacts} new contacts a day (${PLANS.monthly.dailyContacts} on Monthly)`,
              'Free account deletion, anytime',
            ].map((b) => (
              <div key={b} className={styles.benefitItem}>
                <span className={styles.benefitCheck}>
                  <CheckIcon />
                </span>
                {b}
              </div>
            ))}
          </div>

          <div className={styles.sectionLabel}>Plan</div>
          <div className={styles.planToggle}>
            <div className={`${styles.planOption} ${plan === 'weekly' ? styles.selected : ''}`} onClick={() => setPlan('weekly')}>
              <div className={styles.planName}>{PLANS.weekly.label}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>{PLANS.weekly.dailyContacts} contacts a day</div>
              <div className={styles.planPrice}>
                {formatUgx(PLANS.weekly.amount)} <span>{CURRENCY}</span>
              </div>
            </div>
            <div className={`${styles.planOption} ${plan === 'monthly' ? styles.selected : ''}`} onClick={() => setPlan('monthly')}>
              <span className={styles.planBadge}>BEST VALUE</span>
              <div className={styles.planName}>{PLANS.monthly.label}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>{PLANS.monthly.dailyContacts} contacts a day</div>
              <div className={styles.planPrice}>
                {formatUgx(PLANS.monthly.amount)} <span>{CURRENCY}</span>
              </div>
            </div>
          </div>

          <div className={styles.spacer} />

          {paymentProvider === 'nylon' && <PhoneField value={phone} onChange={setPhone} disabled={subscribing} />}

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.cta} onClick={handleSubscribe} disabled={subscribing}>
            {subscribing
              ? paymentProvider === 'nylon'
                ? 'Sending prompt…'
                : 'Taking you to payment…'
              : emailVerified
                ? `Subscribe — ${formatUgx(PLANS[plan].amount)} ${CURRENCY}`
                : 'Verify email & subscribe'}
          </button>
          <div className={styles.fine}>
            {paymentProvider === 'nylon'
              ? "We'll send an approval prompt to your phone. "
              : "You'll choose MTN MoMo or Airtel Money on the secure payment page. "}
            One-time payment: your plan doesn&apos;t renew automatically.
          </div>
        </>
      )}

      <EmailVerifyModal
        open={otpOpen}
        email={email}
        onClose={() => setOtpOpen(false)}
        onVerified={() => {
          setEmailVerified(true)
          setOtpOpen(false)
          setError(null)
        }}
      />
    </main>
  )
}
