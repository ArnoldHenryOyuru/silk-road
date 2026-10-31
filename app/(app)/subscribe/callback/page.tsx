import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { settleByTrackingId, type SettleResult } from '@/lib/payments/settle'
import { settleNylonByReference } from '@/lib/payments/settle-nylon'
import PendingPoller from './PendingPoller'
import styles from '../subscribe.module.css'

export const dynamic = 'force-dynamic'

const TRACKING_ID = /^[0-9a-zA-Z-]{16,64}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

type View = 'done' | 'pending' | 'failed' | 'review' | 'unknown'

/**
 * Pesapal sends the browser here after payment (?OrderTrackingId=...). For Nylon
 * Pay we send the customer here ourselves (?ref=<uuid>) while they approve the
 * prompt on their phone. Either way this page only SHOWS the result: the IPN or
 * webhook route can activate the subscription even if the user never lands here.
 */
export default async function CallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const rawTracking = params.OrderTrackingId
  const trackingId = typeof rawTracking === 'string' ? rawTracking : ''
  const rawRef = params.ref
  const reference = typeof rawRef === 'string' ? rawRef : ''
  const isNylon = UUID.test(reference)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null // (app)/layout.tsx already redirects signed-out users

  let view: View = 'unknown'
  let endDate: string | null = null
  let result: SettleResult | null = null

  try {
    if (isNylon) result = await settleNylonByReference(reference)
    else if (TRACKING_ID.test(trackingId)) result = await settleByTrackingId(trackingId)
  } catch {
    // The provider or the database was unreachable. The IPN or webhook will retry on its own.
    view = 'pending'
  }

  if (result) {
    const admin = createAdminClient()

    // Only show details if this payment belongs to the signed-in user.
    const { data: tx } = result.merchantReference
      ? await admin
          .from('payment_transactions')
          .select('user_id, status')
          .eq('merchant_reference', result.merchantReference)
          .maybeSingle()
      : { data: null }

    if (tx && tx.user_id === user.id) {
      if (result.outcome === 'activated' || result.outcome === 'already_completed') {
        view = 'done'
        const { data: sub } = await admin
          .from('subscriptions')
          .select('end_date')
          .eq('user_id', user.id)
          .eq('payment_ref', result.merchantReference as string)
          .maybeSingle()
        endDate = sub?.end_date ?? null
      } else if (result.outcome === 'pending') view = 'pending'
      else if (result.outcome === 'failed') view = 'failed'
      else if (result.outcome === 'review') view = 'review'
    }
  }

  return (
    <main className={styles.main}>
      <h1>Payment</h1>

      {view === 'done' && (
        <>
          <div className={`${styles.statusCard} ${styles.active}`}>
            <div className={styles.statusLabel}>Status</div>
            <div className={`${styles.statusValue} ${styles.active}`}>
              Subscribed{endDate ? ` · until ${formatDate(endDate)}` : ''}
            </div>
            <div className={styles.statusNote}>Thanks! You can contact anyone on Discover.</div>
          </div>
          <Link href="/discover" className={styles.secondaryBtn}>
            Browse Discover
          </Link>
        </>
      )}

      {view === 'pending' && (
        <>
          <PendingPoller />
          <div className={`${styles.statusCard} ${styles.inactive}`}>
            <div className={styles.statusLabel}>Status</div>
            <div className={`${styles.statusValue} ${styles.inactive}`}>
              {isNylon ? 'Approve the payment on your phone' : 'Waiting for confirmation…'}
            </div>
            <div className={styles.statusNote}>
              {isNylon
                ? 'We sent a prompt to your phone. Enter your mobile money PIN to approve it. '
                : 'If you approved the prompt on your phone, '}
              This page updates by itself. You can also close it: your subscription turns on as soon as the payment is
              confirmed.
            </div>
          </div>
          <Link href="/subscribe" className={styles.secondaryBtn}>
            Back to Subscribe
          </Link>
        </>
      )}

      {view === 'failed' && (
        <>
          <div className={`${styles.statusCard} ${styles.inactive}`}>
            <div className={styles.statusLabel}>Status</div>
            <div className={`${styles.statusValue} ${styles.inactive}`}>Payment didn&apos;t go through</div>
            <div className={styles.statusNote}>You haven&apos;t been charged. You can try again.</div>
          </div>
          <Link href="/subscribe" className={styles.secondaryBtn}>
            Try again
          </Link>
        </>
      )}

      {view === 'review' && (
        <div className={`${styles.statusCard} ${styles.inactive}`}>
          <div className={styles.statusLabel}>Status</div>
          <div className={`${styles.statusValue} ${styles.inactive}`}>We&apos;re checking your payment</div>
          <div className={styles.statusNote}>
            Something needs a manual check before your subscription can start. Contact support and we&apos;ll sort it
            out.
          </div>
        </div>
      )}

      {view === 'unknown' && (
        <>
          <div className={`${styles.statusCard} ${styles.inactive}`}>
            <div className={styles.statusLabel}>Status</div>
            <div className={`${styles.statusValue} ${styles.inactive}`}>We couldn&apos;t find that payment</div>
            <div className={styles.statusNote}>If you were charged, contact support with your payment confirmation.</div>
          </div>
          <Link href="/subscribe" className={styles.secondaryBtn}>
            Back to Subscribe
          </Link>
        </>
      )}
    </main>
  )
}
