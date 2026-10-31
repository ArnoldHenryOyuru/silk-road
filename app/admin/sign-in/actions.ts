'use server'

import { createClient } from '@/lib/supabase/server'

type Result = { error: string } | { success: true }

export async function adminSignIn(formData: FormData): Promise<Result> {
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')

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
