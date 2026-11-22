'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeUgandaPhone } from '@/lib/phone'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { verifySignUpHumanCheck } from '@/lib/security/turnstile'
import { isPhoneBlocklisted } from '@/lib/member-stage'

type SignUpResult = { error: string } | { success: true }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GENERIC_ERROR = 'Could not create your account. Please try again.'
const NUMBER_TAKEN = 'That WhatsApp number is already linked to an account. Try signing in instead.'
const NUMBER_BLOCKED = 'This WhatsApp number cannot be used on Silk Road.'

export async function signUp(formData: FormData): Promise<SignUpResult> {
  const ip = await getClientIp()
  const ipLimit = await checkRateLimit(`signup:ip:${ip}`, 8, 15 * 60_000)
  if (!ipLimit.ok) {
    return {
      error: `Too many sign-up attempts from your connection. Please wait ${Math.ceil(ipLimit.retryAfterSec / 60)} minute(s) and try again.`,
    }
  }

  const honeypot = String(formData.get('website') || '')
  const turnstileToken = String(formData.get('cf-turnstile-response') || '')
  const challengeToken = String(formData.get('challengeToken') || '')

  const humanCheck = await verifySignUpHumanCheck({
    turnstileToken,
    challengeToken,
    honeypot,
    remoteIp: ip,
  })
  if (!humanCheck.ok) {
    return { error: humanCheck.error }
  }

  const displayName = String(formData.get('displayName') || '').trim()
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '')
  const phone = normalizeUgandaPhone(String(formData.get('phone') || '').trim())
  const termsAccepted = formData.get('terms') === '1'

  if (displayName.length < 2 || displayName.length > 60) {
    return { error: 'Enter your name (2 to 60 characters).' }
  }
  if (!phone) {
    return { error: 'Enter a valid Ugandan mobile number (e.g. 07XXXXXXXX).' }
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { error: 'Enter a valid email address.' }
  }

  const emailLimit = await checkRateLimit(`signup:email:${email}`, 4, 15 * 60_000)
  if (!emailLimit.ok) {
    return { error: 'Too many attempts for this email. Please wait a few minutes and try again.' }
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }
  if (password.length > 72) {
    return { error: 'Password is too long (72 characters at most).' }
  }
  if (!termsAccepted) {
    return { error: 'Please confirm you are 18 or older and agree to the Terms.' }
  }

  const admin = createAdminClient()

  // Refuse blocklisted WhatsApp numbers before creating an auth account.
  if (await isPhoneBlocklisted(admin, phone)) {
    return { error: NUMBER_BLOCKED }
  }

  // Number already taken? Checked BEFORE the account exists.
  const { data: taken, error: lookupError } = await admin
    .from('users')
    .select('id')
    .in('phone_number', [phone, `+${phone}`])
    .limit(1)
  if (lookupError) {
    console.error('signup number lookup failed', lookupError.code)
    return { error: GENERIC_ERROR }
  }
  if (taken && taken.length > 0) {
    return { error: NUMBER_TAKEN }
  }

  // Create the account and sign the member in.
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) {
    if (error.code === 'user_already_exists' || /already registered/i.test(error.message)) {
      return { error: 'An account with this email already exists. Try signing in instead.' }
    }
    if (error.code === 'weak_password') {
      return { error: error.message }
    }
    if (error.code === 'over_request_rate_limit' || error.code === 'over_email_send_rate_limit') {
      return { error: 'Too many attempts. Please wait a few minutes and try again.' }
    }
    console.error('signup failed', error.code)
    return { error: GENERIC_ERROR }
  }

  const user = data.user
  if (!user) {
    return { error: GENERIC_ERROR }
  }
  if (!data.session) {
    console.error('signup returned no session: turn OFF Confirm email in Supabase')
    return { error: 'Sign-up is being updated. Please try again in a few minutes.' }
  }

  async function undoSignUp() {
    try {
      await admin.auth.admin.deleteUser(user!.id)
      await supabase.auth.signOut()
    } catch {
      console.error('signup rollback failed')
    }
  }

  const { data: savedUser, error: userError } = await admin
    .from('users')
    .update({ phone_number: phone, terms_accepted_at: new Date().toISOString() })
    .eq('id', user.id)
    .select('id')
    .maybeSingle()

  if (userError || !savedUser) {
    await undoSignUp()
    if (userError?.code === '23505') return { error: NUMBER_TAKEN }
    console.error('signup user update failed', userError?.code)
    return { error: GENERIC_ERROR }
  }

  const { error: profileError } = await admin.from('profiles').insert({
    user_id: user.id,
    display_name: displayName,
    status: 'draft',
    interests: [],
    is_discoverable: true,
    teaser_opt_in: false,
  })

  if (profileError) {
    await undoSignUp()
    console.error('signup draft profile failed', profileError.code)
    return { error: GENERIC_ERROR }
  }

  return { success: true }
}
