import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function MyProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null // (app)/layout.tsx already redirects signed-out users

  const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user.id).maybeSingle()

  if (!profile) {
    // Hasn't created a profile yet — send them to do that instead.
    redirect('/onboarding/profile')
  }

  redirect(`/profile/${profile.id}`)
}
