import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchStatus } from '@/lib/nylon'
import type { SettleResult } from '@/lib/payments/settle'

// Nylon not knowing a reference this long after we created it means the start failed.
const GIVE_UP_AFTER_MS = 3 * 60_000

/** Amount, currency and ids read from a webhook body whose signature already checked out. */
export type SignedPayload = {
  amount?: number
  currency?: string
  transactionId?: string
  method?: string
}

/**
 * The Nylon version of settleByTrackingId(): the ONE place a Nylon payment
 * becomes a subscription. The browser page and the webhook both call it. It
 * re-fetches the real status from Nylon Pay, then the database function
 * activates exactly once. Throws if Nylon Pay or the database can't be reached.
 *
 * The amount we charge is set by our own server, and the signed webhook (when
 * present) supplies an independent amount to compare against the stored one.
 */
export async function settleNylonByReference(reference: string, signed: SignedPayload = {}): Promise<SettleResult> {
  const admin = createAdminClient()

  const { data: row } = await admin
    .from('payment_transactions')
    .select('status, amount, currency, created_at')
    .eq('merchant_reference', reference)
    .eq('provider', 'nylon')
    .maybeSingle()

  if (!row) return { outcome: 'unknown', merchantReference: null }
  if (row.status === 'completed') return { outcome: 'already_completed', merchantReference: reference }
  if (row.status === 'review') return { outcome: 'review', merchantReference: reference }

  const status = await fetchStatus(reference)

  if (status.kind === 'not_found') {
    if (Date.now() - new Date(row.created_at).getTime() > GIVE_UP_AFTER_MS) {
      await markFailed(admin, reference, 'not_found_at_provider')
      return { outcome: 'failed', merchantReference: reference }
    }
    return { outcome: 'pending', merchantReference: reference }
  }

  if (status.status === 'successful') {
    const { data, error } = await admin.rpc('complete_payment', {
      p_merchant_reference: reference,
      p_order_tracking_id: status.transactionId ?? signed.transactionId ?? reference,
      p_amount: signed.amount ?? row.amount,
      p_currency: signed.currency ?? row.currency,
      p_payment_method: signed.method ?? 'mobileMoney',
      p_confirmation_code: status.operatorTid,
    })
    if (error) throw new Error('complete_payment failed')

    if (data === 'activated') return { outcome: 'activated', merchantReference: reference }
    if (data === 'already_completed') return { outcome: 'already_completed', merchantReference: reference }
    if (data === 'not_found') return { outcome: 'unknown', merchantReference: reference }
    return { outcome: 'review', merchantReference: reference }
  }

  if (status.status === 'failed' || status.status === 'cancelled') {
    await markFailed(admin, reference, status.failureReason ?? status.status)
    return { outcome: 'failed', merchantReference: reference }
  }

  // pending, processing, on_hold: the customer hasn't approved yet, or Nylon is still working.
  return { outcome: 'pending', merchantReference: reference }
}

async function markFailed(admin: ReturnType<typeof createAdminClient>, reference: string, reason: string) {
  // A failed attempt can still complete later (complete_payment allows that),
  // so this only moves rows that are still 'initiated'.
  await admin
    .from('payment_transactions')
    .update({ status: 'failed', pesapal_status: reason.slice(0, 200), updated_at: new Date().toISOString() })
    .eq('merchant_reference', reference)
    .eq('status', 'initiated')
}
