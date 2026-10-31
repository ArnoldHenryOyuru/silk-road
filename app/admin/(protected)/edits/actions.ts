'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

async function assertAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!data?.is_admin) throw new Error('Not authorized')
}

export async function approveEdit(editId: string) {
  await assertAdmin()
  const service = createServiceClient()

  // The bio is already live (it was updated the moment the person saved
  // it) — approving just records that a moderator reviewed and accepted it.
  const { error } = await service.from('profile_edits').update({ status: 'approved' }).eq('id', editId)
  if (error) return { error: error.message }

  revalidatePath('/admin/edits')
  revalidatePath('/admin')
  return { success: true as const }
}

export async function rejectEdit(editId: string) {
  await assertAdmin()
  const service = createServiceClient()

  const { data: edit } = await service.from('profile_edits').select('profile_id, old_value').eq('id', editId).single()
  if (!edit) return { error: 'Edit not found.' }

  await service.from('profiles').update({ bio: edit.old_value }).eq('id', edit.profile_id)

  const { error } = await service.from('profile_edits').update({ status: 'rejected' }).eq('id', editId)
  if (error) return { error: error.message }

  revalidatePath('/admin/edits')
  revalidatePath('/admin')
  return { success: true as const }
}
