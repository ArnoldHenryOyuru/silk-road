'use server'

import { createClient } from '@/lib/supabase/server'

type SignUpResult = { error: string } | { success: true; email: string }

export async function signUp(formData: FormData): Promise<SignUpResult> {
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')

  if (!email) {
    return { error: 'Enter your email.' }
  }
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({ email, password })

  if (error) {
    return { error: error.message }
  }

  // NOTE: in the Supabase dashboard, set Auth → Email Templates →
  // "Confirm signup" to send the {{ .Token }} OTP code rather than a
  // magic link, so verify-email/page.tsx has a code to check against.
  return { success: true, email }
}
