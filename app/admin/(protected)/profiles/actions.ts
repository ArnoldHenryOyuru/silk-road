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

export async function approveProfile(profileId: string) {
  await assertAdmin()
  const service = createServiceClient()

  const { error } = await service.from('profiles').update({ status: 'approved' }).eq('id', profileId)
  if (error) return { error: error.message }

  revalidatePath('/admin/profiles')
  revalidatePath('/admin')
  return { success: true as const }
}

export async function rejectProfile(profileId: string) {
  await assertAdmin()
  const service = createServiceClient()

  const { error } = await service.from('profiles').update({ status: 'rejected' }).eq('id', profileId)
  if (error) return { error: error.message }

  revalidatePath('/admin/profiles')
  revalidatePath('/admin')
  return { success: true as const }
}
