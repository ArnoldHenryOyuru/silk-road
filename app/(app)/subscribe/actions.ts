'use server'

import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { submitOrder, isPesapalConfigured } from '@/lib/pesapal'
import { startCollection, isSandboxKey } from '@/lib/nylon'
import { normalizeUgandaPhone } from '@/lib/phone'
import { PLANS, CURRENCY, isPlanId, type PlanId } from '@/lib/payments/plans'
import { paymentProvider } from '@/lib/payments/provider'
import { getMemberStageSummary } from '@/lib/member-stage'

export type CheckoutResult =
  | { error: string; needsEmailVerification?: boolean }
  | { redirectUrl: string }
  | { reference: string }

type Admin = ReturnType<typeof createAdminClient>

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

  const stageSummary = await getMemberStageSummary(admin, user.id, user.email_confirmed_at)

  if (!stageSummary.emailVerified) {
    return {
      error: 'Verify your email with the 6-digit code before subscribing.',
      needsEmailVerification: true,
    }
  }

  if (stageSummary.stage === 'draft') {
    return { error: 'Finish and submit your profile checklist before subscribing.' }
  }

  if (stageSummary.stage === 'rejected') {
    return { error: 'Update and resubmit your profile (or manage your paused plan) before subscribing.' }
  }

  if (stageSummary.pausedSubscription) {
    return { error: 'You already have a paused subscription that will resume when your profile is approved.' }
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

async function startPesapalCheckout(admin: Admin, userId: string, email: string, plan: PlanId): Promise<CheckoutResult> {
  const live = isPesapalConfigured()
  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  const ipnId = process.env.PESAPAL_IPN_ID || 'sandbox-ipn'

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
    const { orderTrackingId, redirectUrl, sandbox } = await submitOrder({
      merchantReference,
      amount: selected.amount,
      currency: CURRENCY,
      description: `Silk Road ${selected.label} subscription`,
      callbackUrl: `${appUrl.replace(/\/+$/, '')}/subscribe/callback`,
      ipnId,
      email,
    })

    if (live && !sandbox && !new URL(redirectUrl).hostname.endsWith('pesapal.com')) {
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

async function startNylonCheckout(
  admin: Admin,
  userId: string,
  email: string,
  plan: PlanId,
  phoneInput: string
): Promise<CheckoutResult> {
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
  const reference = randomUUID()

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
