'use server'

import { createClient } from '@/lib/supabase/server'
import { getPublicAppUrl } from '@/lib/email/mailer'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function requestPasswordReset(email: string) {
  const cleanEmail = String(email || '').trim().toLowerCase()
  if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 254) {
    return { error: 'Enter a valid email address.' }
  }

  const ip = await getClientIp()
  const ipLimit = await checkRateLimit(`forgot:ip:${ip}`, 6, 15 * 60_000)
  if (!ipLimit.ok) {
    return {
      error: `Too many reset requests. Please wait ${Math.ceil(ipLimit.retryAfterSec / 60)} minute(s) and try again.`,
    }
  }

  const emailLimit = await checkRateLimit(`forgot:email:${cleanEmail}`, 3, 15 * 60_000)
  if (!emailLimit.ok) {
    return {
      error: `Too many reset requests for this email. Wait ${Math.ceil(emailLimit.retryAfterSec / 60)} minute(s) and try again.`,
    }
  }

  const supabase = await createClient()
  const baseUrl = getPublicAppUrl()
  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo: `${baseUrl}/auth/callback?next=/reset-password`,
  })
  if (error) return { error: 'Could not send reset email right now. Please try again.' }
  return { success: true as const }
}
