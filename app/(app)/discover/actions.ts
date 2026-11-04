'use server'

import { revalidatePath } from 'next/cache'
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

  revalidatePath('/discover')
}

/**
 * Resolves a wa.me contact link for a profile, per spec §2.4. All the rules
 * (subscription and plan limit, blocks, account status, logging) live in
 * lib/contact.ts, shared with the profile page, so this can't drift out of date.
 */
export async function getContactLink(profileId: string): Promise<ContactResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const result = await unlockContact(user.id, profileId)
  // Refreshes the "contacts left today" counter on the page.
  if (result.ok) revalidatePath('/discover')
  return result
}
