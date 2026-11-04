'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { unlockContact, type ContactResult } from '@/lib/contact'

export async function toggleLike(profileId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: existing } = await supabase
    .from('likes')
    .select('id')
    .eq('liker_id', user.id)
    .eq('liked_profile_id', profileId)
    .maybeSingle()

  if (existing) {
    await supabase.from('likes').delete().eq('id', existing.id)
  } else {
    // Discreet members can't be opened, so they can't be liked either.
    const { data: target } = await supabase
      .from('profiles')
      .select('user_id, is_discoverable')
      .eq('id', profileId)
      .maybeSingle()
    if (!target || (target.is_discoverable === false && target.user_id !== user.id)) return

    await supabase.from('likes').insert({ liker_id: user.id, liked_profile_id: profileId })
  }

  revalidatePath(`/profile/${profileId}`)
}

// All the rules (subscription, blocks, account status, daily limit, logging) live in
// lib/contact.ts so there is only one copy to keep correct.
export async function getContactLink(profileId: string): Promise<ContactResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  return unlockContact(user.id, profileId)
}

export async function reportProfile(profileId: string, reason: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase.from('profiles').select('user_id').eq('id', profileId).single()
  if (!profile) return { error: 'Profile not found.' }

  const { error } = await supabase.from('reports').insert({
    reporter_id: user.id,
    reported_user_id: profile.user_id,
    reason,
  })

  if (error) return { error: error.message }
  return { success: true as const }
}

export async function blockUser(profileId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase.from('profiles').select('user_id').eq('id', profileId).single()
  if (!profile) return { error: 'Profile not found.' }

  await supabase.from('blocks').insert({ blocker_id: user.id, blocked_id: profile.user_id })
  redirect('/discover')
}

// subscribeFake has been removed on purpose. Subscriptions are now created only
// by a confirmed Pesapal payment (see lib/payments/settle.ts and the
// complete_payment() database function).
