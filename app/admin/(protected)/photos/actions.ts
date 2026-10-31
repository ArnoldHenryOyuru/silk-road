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

export async function approvePhoto(photoId: string) {
  await assertAdmin()
  const service = createServiceClient()

  const { data: photo } = await service.from('profile_photos').select('profile_id, is_primary').eq('id', photoId).single()
  if (!photo) return { error: 'Photo not found.' }

  if (photo.is_primary) {
    // Exactly one primary per profile — clear any other primary before
    // this one goes live, so an approved main-photo swap doesn't leave
    // two photos both marked primary.
    await service.from('profile_photos').update({ is_primary: false }).eq('profile_id', photo.profile_id).neq('id', photoId)
  }

  const { error } = await service.from('profile_photos').update({ status: 'approved' }).eq('id', photoId)
  if (error) return { error: error.message }

  revalidatePath('/admin/photos')
  revalidatePath('/admin')
  return { success: true as const }
}

export async function rejectPhoto(photoId: string) {
  await assertAdmin()
  const service = createServiceClient()

  const { data: photo } = await service.from('profile_photos').select('image_url').eq('id', photoId).single()

  const { error } = await service.from('profile_photos').update({ status: 'rejected' }).eq('id', photoId)
  if (error) return { error: error.message }

  if (photo) {
    await service.storage.from('profile-photos').remove([photo.image_url])
  }

  revalidatePath('/admin/photos')
  revalidatePath('/admin')
  return { success: true as const }
}
