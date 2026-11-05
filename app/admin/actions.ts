'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { notifyAdmins } from '@/lib/push/send'

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  const { data } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!data?.is_admin) throw new Error('Not an admin')
  return user
}

export async function signOutAdmin() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/admin/sign-in')
}

export async function savePushSubscription(
  sub: { endpoint: string; p256dh: string; auth: string },
  userAgent?: string
) {
  const user = await requireAdmin()
  if (typeof sub?.endpoint !== 'string' || !sub.endpoint.startsWith('https://') || !sub.p256dh || !sub.auth) {
    return { ok: false }
  }

  const service = createServiceClient()
  const { error } = await service.from('admin_push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      user_agent: userAgent?.slice(0, 300) ?? null,
    },
    { onConflict: 'endpoint' }
  )
  if (error) return { ok: false }

  // Confirmation ping to this device only
  await notifyAdmins(
    { title: 'Notifications are on', body: 'You will be alerted when something needs review.', url: '/admin' },
    { onlyEndpoint: sub.endpoint }
  )
  return { ok: true }
}

export async function removePushSubscription(endpoint: string) {
  const user = await requireAdmin()
  const service = createServiceClient()
  await service.from('admin_push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', user.id)
  return { ok: true }
}
