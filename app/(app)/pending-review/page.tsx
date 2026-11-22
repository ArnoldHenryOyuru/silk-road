import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Clock, PauseCircle, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMemberStageSummary } from '@/lib/member-stage'
import { getContactAllowance } from '@/lib/contact'
import RefundRequestButton from './PendingReviewClient'
import styles from '../../(auth)/auth.module.css'

export default async function PendingReviewPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const [summary, allowance] = await Promise.all([
    getMemberStageSummary(admin, user.id, user.email_confirmed_at),
    getContactAllowance(user.id),
  ])

  if (summary.stage === 'draft') {
    redirect('/onboarding/profile')
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '44px 20px 70px' }}>
      <div className={styles.card} style={{ maxWidth: 480, width: '100%' }}>
        {summary.stage === 'approved' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, color: 'var(--success)' }}>
              <CheckCircle2 size={22} />
              <span style={{ fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Approved
              </span>
            </div>
            <h1>Your profile is live</h1>
            <p className={styles.subtitle}>
              You&apos;ve been approved and have full access to your plan limits on Silk Road.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
              <Link href="/discover" className={styles.primaryBtn} style={{ textAlign: 'center', textDecoration: 'none', lineHeight: '48px' }}>
                Open Discover
              </Link>
              <Link href="/profile" style={{ textAlign: 'center', fontSize: 13.5, fontWeight: 700, color: 'var(--accent-primary)', textDecoration: 'none', padding: 8 }}>
                View my profile
              </Link>
            </div>
          </>
        )}

        {summary.stage === 'pending_review' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--accent-warm)' }}>
              <Clock size={20} />
              <span style={{ fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                In Review
              </span>
            </div>
            <h1>Your profile is in review</h1>
            <p className={styles.subtitle}>
              We check new profiles and photos before listing them on Discover. Most reviews finish within a few hours.
            </p>

            <div
              style={{
                borderRadius: 14,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                fontSize: 13.5,
                marginTop: 18,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={16} color="var(--success)" />
                <span>Email verified ({user.email})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={16} color="var(--accent-warm)" />
                <span>Not visible to other members until approved</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={16} color="var(--accent-primary)" />
                <span>
                  {summary.activeSubscription
                    ? `Subscribed (${summary.activeSubscription.planType}): 1 contact/day while pending (${allowance.remaining} left today). Full plan unlocks on approval.`
                    : 'You can browse Discover and subscribe now to unlock 1 contact/day while waiting.'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
              <Link
                href="/discover"
                className={styles.primaryBtn}
                style={{ textAlign: 'center', textDecoration: 'none', lineHeight: '48px' }}
              >
                Browse Discover
              </Link>
              {!summary.activeSubscription && (
                <Link
                  href="/subscribe"
                  style={{
                    textAlign: 'center',
                    height: 44,
                    lineHeight: '42px',
                    borderRadius: 12,
                    border: '1.5px solid var(--accent-primary)',
                    color: 'var(--accent-primary)',
                    fontWeight: 700,
                    fontSize: 14,
                    textDecoration: 'none',
                  }}
                >
                  Subscribe while waiting (1 contact/day)
                </Link>
              )}
              <Link
                href="/profile/edit"
                style={{
                  textAlign: 'center',
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                  padding: 6,
                }}
              >
                Edit profile details
              </Link>
            </div>
          </>
        )}

        {summary.stage === 'rejected' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--danger)' }}>
              <AlertTriangle size={20} />
              <span style={{ fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Action Needed
              </span>
            </div>
            <h1>Updates needed</h1>
            <p className={styles.subtitle}>
              {summary.rejectionReason ||
                'Your profile did not pass our review guidelines. Update your details or photos and resubmit.'}
            </p>

            <div
              style={{
                borderRadius: 14,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                fontSize: 13.5,
                marginTop: 16,
              }}
            >
              <div>
                <strong>14-day recovery window:</strong>{' '}
                {summary.fixWindowExpired
                  ? 'Your 14-day window has ended.'
                  : `${summary.daysLeftInFixWindow} day${summary.daysLeftInFixWindow === 1 ? '' : 's'} left to fix & resubmit or request a refund.`}
              </div>
              {summary.pausedSubscription && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
                  <PauseCircle size={16} color="var(--accent-warm)" />
                  <span>
                    Your <strong>{summary.pausedSubscription.planType}</strong> plan ({summary.pausedSubscription.remainingDays}d
                    remaining) is paused until you resubmit and get approved.
                  </span>
                </div>
              )}
              {summary.refundRequestStatus && (
                <div style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                  Refund request status: {summary.refundRequestStatus}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
              <Link
                href="/onboarding/profile"
                className={styles.primaryBtn}
                style={{ textAlign: 'center', textDecoration: 'none', lineHeight: '48px' }}
              >
                Fix &amp; resubmit profile
              </Link>
              {summary.pausedSubscription && !summary.fixWindowExpired && !summary.refundRequestStatus && (
                <RefundRequestButton subscriptionId={summary.pausedSubscription.id} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
