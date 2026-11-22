'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { runLifecycleSweep, type LifecycleSweepResult } from '@/lib/lifecycle/sweep'

export async function triggerLifecycleSweep(): Promise<
  { ok: true; summary: LifecycleSweepResult } | { ok: false; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const { data } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!data?.is_admin) return { ok: false, error: 'Not authorized' }

  const summary = await runLifecycleSweep()

  revalidatePath('/admin')
  revalidatePath('/admin/payments')
  revalidatePath('/admin/members')
  return { ok: true, summary }
}
