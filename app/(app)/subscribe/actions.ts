'use server'

import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { submitOrder } from '@/lib/pesapal'
import { startCollection, isSandboxKey } from '@/lib/nylon'
import { normalizeUgandaPhone } from '@/lib/phone'
import { PLANS, CURRENCY, isPlanId, type PlanId } from '@/lib/payments/plans'
import { paymentProvider } from '@/lib/payments/provider'

// Pesapal sends the browser to its hosted page; Nylon Pay prompts the customer's
// phone, so we just return the reference and the waiting page takes over.
export type CheckoutResult = { error: string } | { redirectUrl: string } | { reference: string }

type Admin = ReturnType<typeof createAdminClient>

/**
 * Starts a checkout with whichever gateway NEXT_PUBLIC_PAYMENT_PROVIDER selects.
 * The price comes from lib/payments/plans.ts on the server, never from the
 * browser. Nothing here activates a subscription: only the settle functions do,
 * after the provider confirms payment.
 */
export async function initiateCheckout(plan: string, phone?: string): Promise<CheckoutResult> {
  if (!isPlanId(plan)) return { error: 'Choose a plan to continue.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !user.email) return { error: 'Please sign in again to continue.' }

  const admin = createAdminClient()

  const { data: account } = await admin.from('users').select('status').eq('id', user.id).maybeSingle()
  if (account?.status !== 'active') {
    return { error: "Your account can't make purchases right now." }
  }

  const { data: existing } = await admin
    .from('subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .gte('end_date', new Date().toISOString())
    .limit(1)
  if (existing && existing.length > 0) {
    return { error: 'You already have an active subscription.' }
  }

  // Basic abuse guard: at most 5 checkout attempts per 10 minutes.
  const since = new Date(Date.now() - 10 * 60_000).toISOString()
  const { count } = await admin
    .from('payment_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since)
  if ((count ?? 0) >= 5) {
    return { error: 'Too many attempts. Please wait a few minutes and try again.' }
  }

  return paymentProvider === 'nylon'
    ? startNylonCheckout(admin, user.id, user.email, plan, phone ?? '')
    : startPesapalCheckout(admin, user.id, user.email, plan)
}

/* ------------------------------------------------------------------ */
/* Pesapal: hosted checkout page                                       */
/* ------------------------------------------------------------------ */
async function startPesapalCheckout(admin: Admin, userId: string, email: string, plan: PlanId): Promise<CheckoutResult> {
  const appUrl = process.env.APP_URL
  const ipnId = process.env.PESAPAL_IPN_ID
  if (!appUrl || !ipnId) {
    console.error('Payments are not configured: APP_URL or PESAPAL_IPN_ID is missing')
    return { error: "Payments aren't available right now. Please try again later." }
  }

  const selected = PLANS[plan]
  const merchantReference = `SR-${randomUUID()}`

  const { error: insertError } = await admin.from('payment_transactions').insert({
    user_id: userId,
    plan_type: plan,
    amount: selected.amount,
    currency: CURRENCY,
    merchant_reference: merchantReference,
    provider: 'pesapal',
  })
  if (insertError) {
    return { error: "We couldn't start the payment. Please try again." }
  }

  try {
    const { orderTrackingId, redirectUrl } = await submitOrder({
      merchantReference,
      amount: selected.amount,
      currency: CURRENCY,
      description: `Silk Road ${selected.label} subscription`,
      callbackUrl: `${appUrl.replace(/\/+$/, '')}/subscribe/callback`,
      ipnId,
      email,
    })

    // Only ever send the browser to Pesapal.
    if (!new URL(redirectUrl).hostname.endsWith('pesapal.com')) {
      throw new Error('Unexpected checkout host')
    }

    await admin
      .from('payment_transactions')
      .update({ order_tracking_id: orderTrackingId, updated_at: new Date().toISOString() })
      .eq('merchant_reference', merchantReference)

    return { redirectUrl }
  } catch {
    await failAttempt(admin, merchantReference, 'order_request_failed')
    return { error: "We couldn't start the payment. Please try again in a moment." }
  }
}

/* ------------------------------------------------------------------ */
/* Nylon Pay: prompt on the customer's phone                           */
/* ------------------------------------------------------------------ */
async function startNylonCheckout(
  admin: Admin,
  userId: string,
  email: string,
  plan: PlanId,
  phoneInput: string
): Promise<CheckoutResult> {
  // A sandbox key in production would let anyone "pay" with fake money and get a
  // real subscription. Refuse unless you explicitly allow it for a test window.
  if (isSandboxKey() && process.env.VERCEL_ENV === 'production' && process.env.NYLONPAY_ALLOW_SANDBOX !== 'true') {
    console.error('Refusing checkout: Nylon Pay sandbox key is configured in production')
    return { error: "Payments aren't available right now. Please try again later." }
  }

  const phone = normalizeUgandaPhone(phoneInput.trim())
  if (!phone) {
    return { error: 'Enter a valid MTN or Airtel number (e.g. 07XXXXXXXX).' }
  }

  const { data: profile } = await admin.from('profiles').select('display_name').eq('user_id', userId).maybeSingle()
  const customerName = profile?.display_name || 'Silk Road member'

  const selected = PLANS[plan]
  const reference = randomUUID() // Nylon Pay requires a plain UUID (no prefix)

  // The number you pay with is sent to Nylon Pay and deliberately NOT stored here.
  const { error: insertError } = await admin.from('payment_transactions').insert({
    user_id: userId,
    plan_type: plan,
    amount: selected.amount,
    currency: CURRENCY,
    merchant_reference: reference,
    provider: 'nylon',
  })
  if (insertError) {
    return { error: "We couldn't start the payment. Please try again." }
  }

  try {
    await startCollection({
      reference,
      amount: selected.amount,
      description: `Silk Road ${selected.label} subscription`,
      customerName,
      phoneNumber: phone,
      email,
    })
    return { reference }
  } catch {
    await failAttempt(admin, reference, 'collection_start_failed')
    return { error: "We couldn't send the payment prompt. Check the number and try again." }
  }
}

async function failAttempt(admin: Admin, merchantReference: string, reason: string) {
  await admin
    .from('payment_transactions')
    .update({ status: 'failed', pesapal_status: reason, updated_at: new Date().toISOString() })
    .eq('merchant_reference', merchantReference)
    .eq('status', 'initiated')
}
