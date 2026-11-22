'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { issueEmailOtp, verifyEmailOtpCode } from '@/lib/email/otp'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'

export type SendOtpResult =
  | { ok: true; email: string; sandboxCode?: string }
  | { ok: false; error: string }

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; error: string }

export async function sendVerificationCode(): Promise<SendOtpResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email) {
    return { ok: false, error: 'Please sign in again to verify your email.' }
  }

  const ip = await getClientIp()
  const ipLimit = await checkRateLimit(`otp:send:ip:${ip}`, 10, 15 * 60_000)
  if (!ipLimit.ok) {
    return { ok: false, error: `Too many requests. Try again in ${ipLimit.retryAfterSec}s.` }
  }

  const admin = createAdminClient()
  const { data: account } = await admin
    .from('users')
    .select('email_verified_at')
    .eq('id', user.id)
    .maybeSingle()

  if (account?.email_verified_at) {
    return { ok: true, email: user.email }
  }

  const issued = await issueEmailOtp(user.id, user.email)
  if (!issued.ok) {
    return { ok: false, error: issued.error }
  }

  return {
    ok: true,
    email: user.email,
    sandboxCode: issued.sandboxCode,
  }
}

export async function confirmVerificationCode(code: string): Promise<VerifyOtpResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email) {
    return { ok: false, error: 'Please sign in again to verify your email.' }
  }

  const check = await verifyEmailOtpCode(user.id, user.email, code)
  if (!check.ok) {
    return { ok: false, error: check.error }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('users')
    .update({ email_verified_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    return { ok: false, error: 'Could not save email verification status. Please try again.' }
  }

  revalidatePath('/onboarding/profile')
  revalidatePath('/subscribe')
  revalidatePath('/pending-review')
  revalidatePath('/discover')
  return { ok: true }
}
