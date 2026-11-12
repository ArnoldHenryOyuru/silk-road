'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeUgandaPhone } from '@/lib/phone'

type SignUpResult = { error: string } | { success: true }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GENERIC_ERROR = 'Could not create your account. Please try again.'
const NUMBER_TAKEN = 'That WhatsApp number is already linked to an account. Try signing in instead.'

/**
 * Brief sign-up: name, WhatsApp number, email, password. Nothing else.
 *
 * What it does, in order (every check is repeated here on the server, because
 * the page's checks can be skipped by anyone calling this action directly):
 *   1. validate the form
 *   2. refuse a WhatsApp number that already belongs to someone
 *   3. create the account and sign the member in
 *   4. save the number and the Terms acceptance on public.users
 *   5. create a 'draft' profile (name only). A draft is invisible everywhere:
 *      not in the review queues, Discover or the homepage teaser.
 * If step 4 or 5 fails, the account is deleted again so nobody is left with a
 * half-made account they can't sign up with a second time.
 *
 * Needs Supabase Authentication -> Providers -> Email -> "Confirm email" OFF.
 * Email verification now happens when the member submits their profile.
 */
export async function signUp(formData: FormData): Promise<SignUpResult> {
  // Honeypot: a hidden field real people never fill in. A stopgap against the
  // simplest bots until rate limiting and CAPTCHA arrive.
  if (String(formData.get('website') || '').trim() !== '') {
    return { error: GENERIC_ERROR }
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

  // 2. Number already taken? Checked BEFORE the account exists, so a refused
  //    sign-up leaves nothing behind. The unique index on users.phone_number
  //    is the final guard if two people race.
  const { data: taken, error: lookupError } = await admin
    .from('users')
    .select('id')
    .eq('phone_number', phone)
    .limit(1)
  if (lookupError) {
    console.error('signup number lookup failed', lookupError.code)
    return { error: GENERIC_ERROR }
  }
  if (taken && taken.length > 0) {
    return { error: NUMBER_TAKEN }
  }

  // 3. Create the account (this also signs the member in).
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
    // No session means Supabase is still waiting for an email confirmation:
    // "Confirm email" has not been turned off yet.
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

  // 4. Save the number and the Terms acceptance.
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

  // 5. The draft profile. Status 'draft' is set here, by the server, and
  //    members can't write that column themselves.
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
