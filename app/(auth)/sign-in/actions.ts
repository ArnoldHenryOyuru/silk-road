'use server'

import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/members-only'

type SignInResult = { error: string } | { success: true; redirectTo: string }

export async function signIn(formData: FormData): Promise<SignInResult> {
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')
  // Where the visitor was headed before sign-in. Only members-only pages are
  // accepted, so this can't be used to send anyone to another website.
  const next = safeNext(formData.get('next'), '')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    // Same message either way — don't confirm whether the account exists.
    return { error: 'Incorrect email or password.' }
  }

  const { data: accountRow } = await supabase
    .from('users')
    .select('status')
    .eq('id', data.user.id)
    .single()

  switch (accountRow?.status) {
    case 'deletion_pending':
      await supabase.auth.signOut()
      return { error: 'This account is pending deletion and can no longer be accessed.' }

    case 'suspended':
      await supabase.auth.signOut()
      return { error: 'Account suspended. Contact support if you believe this is a mistake.' }

    case 'banned':
      await supabase.auth.signOut()
      return { error: 'This account has been banned. You can appeal this decision.' }

    case 'deactivated':
      // Deliberately reversible (spec §2.7) — sign-in succeeds, user lands
      // on a reactivation prompt rather than straight into Discover.
      return { success: true, redirectTo: '/reactivate' }

    default:
      return { success: true, redirectTo: next || '/discover' }
  }
}