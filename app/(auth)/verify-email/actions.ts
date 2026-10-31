'use server'

import { createClient } from '@/lib/supabase/server'

export async function verifyEmailOtp(email: string, token: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' })
  if (error) return { error: error.message }
  return { success: true as const }
}

export async function resendOtp(email: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.resend({ type: 'signup', email })
  if (error) return { error: error.message }
  return { success: true as const }
}
