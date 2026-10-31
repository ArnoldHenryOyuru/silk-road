import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTransactionStatus } from '@/lib/pesapal'

export type SettleOutcome =
  | 'activated' // this call turned the payment into a subscription
  | 'already_completed' // an earlier call (callback or IPN) already did
  | 'pending' // not paid yet (or Pesapal hasn't confirmed)
  | 'failed'
  | 'review' // needs a human: see payment_transactions.status = 'review'
  | 'unknown'

export type SettleResult = { outcome: SettleOutcome; merchantReference: string | null }

/**
 * The ONE place a payment becomes a subscription. Used by both the browser
 * callback page and the IPN webhook. It never trusts what the caller says: it
 * re-fetches the real status from Pesapal, then lets the database function
 * compare the amount and currency to what we stored and activate exactly once.
 * Throws if Pesapal or the database can't be reached (callers decide how to retry).
 */
export async function settleByTrackingId(orderTrackingId: string): Promise<SettleResult> {
  const status = await getTransactionStatus(orderTrackingId)
  const merchantReference = status.merchant_reference
  const admin = createAdminClient()

  // 1 = COMPLETED
  if (status.status_code === 1) {
    const { data, error } = await admin.rpc('complete_payment', {
      p_merchant_reference: merchantReference,
      p_order_tracking_id: orderTrackingId,
      p_amount: status.amount,
      p_currency: status.currency,
      p_payment_method: status.payment_method ?? null,
      p_confirmation_code: status.confirmation_code ?? null,
    })
    if (error) throw new Error('complete_payment failed')

    if (data === 'activated') return { outcome: 'activated', merchantReference }
    if (data === 'already_completed') return { outcome: 'already_completed', merchantReference }
    if (data === 'not_found') return { outcome: 'unknown', merchantReference }
    return { outcome: 'review', merchantReference }
  }

  // 2 = FAILED. A customer can retry the same order, so 'failed' can still
  // become 'completed' later (complete_payment allows that).
  if (status.status_code === 2) {
    await admin
      .from('payment_transactions')
      .update({
        status: 'failed',
        pesapal_status: status.payment_status_description,
        order_tracking_id: orderTrackingId,
        updated_at: new Date().toISOString(),
      })
      .eq('merchant_reference', merchantReference)
      .eq('status', 'initiated')
    return { outcome: 'failed', merchantReference }
  }

  // 3 = REVERSED (refund/chargeback). The subscription is NOT removed
  // automatically; the row is flagged so you can decide what to do.
  if (status.status_code === 3) {
    await admin
      .from('payment_transactions')
      .update({
        status: 'review',
        pesapal_status: status.payment_status_description,
        updated_at: new Date().toISOString(),
      })
      .eq('merchant_reference', merchantReference)
      .in('status', ['initiated', 'completed'])
    return { outcome: 'review', merchantReference }
  }

  // 0 = INVALID also appears for orders that exist but haven't been paid yet,
  // so it is treated as "still pending", never as a failure.
  return { outcome: 'pending', merchantReference }
}
