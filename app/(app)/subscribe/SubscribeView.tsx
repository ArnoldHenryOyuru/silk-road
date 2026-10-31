'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { initiateCheckout } from './actions'
import PhoneField from './PhoneField'
import { PLANS, CURRENCY, formatUgx, type PlanId } from '@/lib/payments/plans'
import { paymentProvider } from '@/lib/payments/provider'
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
}: {
  isSubscribed: boolean
  endDate: string | null
  defaultPhone?: string | null
}) {
  const router = useRouter()
  const [plan, setPlan] = useState<PlanId>('weekly')
  const [phone, setPhone] = useState(defaultPhone ?? '')
  const [subscribing, setSubscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubscribe() {
    setError(null)
    setSubscribing(true)
    const result = await initiateCheckout(plan, phone)
    if ('error' in result) {
      setError(result.error)
      setSubscribing(false)
      return
    }
    if ('redirectUrl' in result) {
      // Pesapal: keep the button disabled while the browser leaves for its page.
      window.location.href = result.redirectUrl
      return
    }
    // Nylon Pay: the prompt is on its way to the phone; the waiting page takes over.
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
            <div className={styles.statusNote}>You can contact anyone on Discover until then.</div>
          </div>
          <button className={styles.secondaryBtn} onClick={() => router.push('/discover')}>
            Browse Discover
          </button>
        </>
      ) : (
        <>
          <div className={`${styles.statusCard} ${styles.inactive}`}>
            <div className={styles.statusLabel}>Status</div>
            <div className={`${styles.statusValue} ${styles.inactive}`}>Not subscribed</div>
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
              : `Subscribe — ${formatUgx(PLANS[plan].amount)} ${CURRENCY}`}
          </button>
          <div className={styles.fine}>
            {paymentProvider === 'nylon'
              ? "We'll send an approval prompt to your phone. "
              : "You'll choose MTN MoMo or Airtel Money on the secure payment page. "}
            One-time payment: your plan doesn&apos;t renew automatically.
          </div>
        </>
      )}
    </main>
  )
}
