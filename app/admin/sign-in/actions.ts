'use server'

import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'

type Result = { error: string } | { success: true }

export async function adminSignIn(formData: FormData): Promise<Result> {
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '')

  if (!email || !password) {
    return { error: 'Enter both your email and password.' }
  }

  const ip = await getClientIp()
  const ipLimit = await checkRateLimit(`admin-signin:ip:${ip}`, 8, 15 * 60_000)
  if (!ipLimit.ok) {
    return {
      error: `Too many admin sign-in attempts. Please wait ${Math.ceil(ipLimit.retryAfterSec / 60)} minute(s) and try again.`,
    }
  }

  const emailLimit = await checkRateLimit(`admin-signin:email:${email}`, 5, 15 * 60_000)
  if (!emailLimit.ok) {
    return {
      error: `Too many attempts for this account. Please wait ${Math.ceil(emailLimit.retryAfterSec / 60)} minute(s) and try again.`,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return { error: 'Incorrect email or password.' }
  }

  const { data: accountRow } = await supabase.from('users').select('is_admin').eq('id', data.user.id).single()

  if (!accountRow?.is_admin) {
    // Deliberately not "wrong password" — this account IS valid, it's just
    // not an admin. Sign it back out so a non-admin session never lingers
    // in the browser after a failed admin login attempt.
    await supabase.auth.signOut()
    return { error: 'This account is not authorized for admin access.' }
  }

  return { success: true }
}
