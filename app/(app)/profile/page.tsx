import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function MyProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile || profile.status === 'draft') {
    redirect('/onboarding/profile')
  }
  if (profile.status === 'rejected') {
    redirect('/pending-review')
  }

  redirect(`/profile/${profile.id}`)
}
