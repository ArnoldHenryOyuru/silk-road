import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FIX_WINDOW_DAYS } from '@/lib/member-stage'
import ProfileChecklist, { type ProfileChecklistInitial } from './ProfileChecklist'

function approximateDob(age?: number | null): string {
  if (!age || age < 18) return ''
  const year = new Date().getFullYear() - age
  return `${year}-06-15`
}

function computeDaysLeft(rejectedAt: string | null): number {
  if (!rejectedAt) return FIX_WINDOW_DAYS
  const deadline = new Date(rejectedAt).getTime() + FIX_WINDOW_DAYS * 86_400_000
  return Math.max(0, Math.ceil((deadline - Date.now()) / 86_400_000))
}

export default async function OnboardingProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()

  const [{ data: account }, { data: profile }] = await Promise.all([
    admin.from('users').select('phone_number, email_verified_at').eq('id', user.id).maybeSingle(),
    admin
      .from('profiles')
      .select(
        `
        id, status, display_name, age, campus, bio, looking_for, show_me, interests,
        is_discoverable, teaser_opt_in, verification_selfie_path, rejected_at, rejection_reason,
        profile_photos ( id, image_url, status, is_primary )
      `
      )
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (profile?.status === 'pending_review') {
    redirect('/pending-review')
  }
  if (profile?.status === 'approved') {
    redirect('/profile/edit')
  }

  const visiblePhotos = (profile?.profile_photos ?? []).filter(
    (p: { status: string }) => p.status !== 'rejected'
  )

  const photos = await Promise.all(
    visiblePhotos.map(async (p: { id: string; image_url: string; is_primary: boolean }) => {
      const { data } = await admin.storage.from('profile-photos').createSignedUrl(p.image_url, 3600)
      return {
        id: p.id,
        url: data?.signedUrl ?? '',
        isPrimary: Boolean(p.is_primary),
      }
    })
  )

  let selfieUrl: string | null = null
  if (profile?.verification_selfie_path) {
    const { data } = await admin.storage
      .from('profile-photos')
      .createSignedUrl(String(profile.verification_selfie_path), 3600)
    selfieUrl = data?.signedUrl ?? null
  }

  const rejectedAt = (profile?.rejected_at as string | null | undefined) ?? null
  const daysLeftInFixWindow = computeDaysLeft(rejectedAt)

  const initial: ProfileChecklistInitial = {
    email: user.email ?? '',
    emailVerified: Boolean(account?.email_verified_at || user.email_confirmed_at),
    status: profile?.status === 'rejected' ? 'rejected' : 'draft',
    rejectionReason: (profile?.rejection_reason as string | null | undefined) ?? null,
    daysLeftInFixWindow,
    displayName: profile?.display_name ?? '',
    dob: approximateDob(profile?.age),
    campus: profile?.campus ?? '',
    phone: account?.phone_number ?? '',
    lookingFor: profile?.looking_for ?? null,
    showMe: profile?.show_me ?? null,
    bio: profile?.bio ?? '',
    interests: Array.isArray(profile?.interests) ? profile.interests : [],
    isDiscoverable: profile?.is_discoverable !== false,
    teaserOptIn: Boolean(profile?.teaser_opt_in),
    photos: photos.filter((p) => p.url),
    selfieUrl,
  }

  return <ProfileChecklist initial={initial} />
}
