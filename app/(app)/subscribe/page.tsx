import { getCachedAuthUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMemberStageSummary } from '@/lib/member-stage'
import SubscribeView from './SubscribeView'

export default async function SubscribePage() {
  const { user } = await getCachedAuthUser()
  if (!user) return null

  const admin = createAdminClient()
  const [stageSummary, { data: account }] = await Promise.all([
    getMemberStageSummary(admin, user.id, user.email_confirmed_at),
    admin.from('users').select('phone_number').eq('id', user.id).maybeSingle(),
  ])

  return (
    <SubscribeView
      isSubscribed={Boolean(stageSummary.activeSubscription)}
      endDate={stageSummary.activeSubscription?.endDate ?? null}
      defaultPhone={account?.phone_number ?? null}
      stage={stageSummary.stage}
      email={user.email ?? ''}
      emailVerified={stageSummary.emailVerified}
      hasPausedSubscription={Boolean(stageSummary.pausedSubscription)}
    />
  )
}
