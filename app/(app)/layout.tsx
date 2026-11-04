import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppHeader from '@/components/AppHeader'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Signed-out visitors see the "what to expect" home page. middleware.ts adds
    // ?next= for the main members-only pages; this is the safety net for the rest.
    redirect('/')
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('end_date')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .gte('end_date', new Date().toISOString())
    .order('end_date', { ascending: false })
    .maybeSingle()

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, campus, face_match_verified, profile_photos ( image_url, status, is_primary )')
    .eq('user_id', user.id)
    .maybeSingle()

  let avatarUrl: string | null = null
  if (profile) {
    const approvedPhoto = (profile.profile_photos ?? []).find((p: any) => p.status === 'approved')
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
