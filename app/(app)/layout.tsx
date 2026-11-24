import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getCachedAuthUser } from '@/lib/supabase/server'
import AppHeader from '@/components/AppHeader'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { supabase, user } = await getCachedAuthUser()

  if (!user) {
    // Signed-out visitors see the "what to expect" home page. middleware.ts adds
    // ?next= for the main members-only pages; this is the safety net for the rest.
    redirect('/')
  }

  const [{ data: subscription }, { data: profile }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('end_date')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString())
      .order('end_date', { ascending: false })
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('display_name, campus, face_match_verified, profile_photos ( image_url, status, is_primary )')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  let avatarUrl: string | null = null
  if (profile) {
    type ProfilePhotoRow = { image_url: string; status: string; is_primary?: boolean }
    const photoRows = (profile.profile_photos ?? []) as ProfilePhotoRow[]
    const approvedPhoto =
      photoRows.find((p) => p.status === 'approved' && p.is_primary) ??
      photoRows.find((p) => p.status === 'approved')
    if (approvedPhoto) {
      const { data: signed } = await supabase.storage
        .from('profile-photos')
        .createSignedUrl(approvedPhoto.image_url, 3600)
      avatarUrl = signed?.signedUrl ?? null
    }
  }

  return (
    <>
      <AppHeader
        isSubscribed={!!subscription}
        subscriptionEndDate={subscription?.end_date ?? null}
        displayName={profile?.display_name ?? null}
        campus={profile?.campus ?? null}
        verified={!!profile?.face_match_verified}
        avatarUrl={avatarUrl}
      />
      {children}
    </>
  )
}
