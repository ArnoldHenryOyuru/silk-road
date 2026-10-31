import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditProfileForm, { type EditProfileInitialData } from './EditProfileForm'

// The wizard stores age, not date of birth — for editing, back-calculate a
// reasonable DOB (mid-year) so the date input has something sensible to
// show. It'll be recalculated properly from whatever the person picks next.
function approximateDob(age: number): string {
  const year = new Date().getFullYear() - age
  return `${year}-06-15`
}

export default async function EditProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      `
      id, display_name, age, campus, bio, looking_for, show_me, interests,
      profile_photos ( id, image_url, status, is_primary )
    `
    )
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile) {
    redirect('/onboarding/profile')
  }

  const { data: accountRow } = await supabase.from('users').select('phone_number').eq('id', user.id).single()

  const visiblePhotos = (profile.profile_photos ?? []).filter((p: any) => p.status !== 'rejected')

  const photos = await Promise.all(
    visiblePhotos.map(async (p: any) => {
      const { data } = await supabase.storage.from('profile-photos').createSignedUrl(p.image_url, 3600)
      return {
        id: p.id,
        url: data?.signedUrl ?? '',
        isPrimary: !!p.is_primary,
        isPending: p.status === 'pending',
      }
    })
  )

  const initial: EditProfileInitialData = {
    displayName: profile.display_name,
    dob: approximateDob(profile.age),
    campus: profile.campus,
    phone: accountRow?.phone_number ?? '',
    lookingFor: profile.looking_for,
    showMe: profile.show_me,
    bio: profile.bio ?? '',
    interests: profile.interests ?? [],
    photos: photos.filter((p) => p.url),
  }

  return <EditProfileForm initial={initial} />
}
