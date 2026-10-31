import { createClient } from '@/lib/supabase/server'
import SubscribeView from './SubscribeView'

export default async function SubscribePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null // (app)/layout.tsx already redirects signed-out users

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('end_date')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .gte('end_date', new Date().toISOString())
    .order('end_date', { ascending: false })
    .maybeSingle()

  // Pre-fills the mobile money number field with the number they signed up with
  // (they can change it: the number they pay with isn't always their WhatsApp number).
  const { data: account } = await supabase.from('users').select('phone_number').eq('id', user.id).maybeSingle()

  return (
    <SubscribeView
      isSubscribed={!!subscription}
      endDate={subscription?.end_date ?? null}
      defaultPhone={account?.phone_number ?? null}
    />
  )
}
