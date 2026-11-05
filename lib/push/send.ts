import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase/service'

export type PushPayload = { title: string; body: string; url?: string; tag?: string }

let configured = false
function configure() {
  if (configured) return true
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com', pub, priv)
  configured = true
  return true
}

/** Send a push to every registered admin device (or just one endpoint). */
export async function notifyAdmins(payload: PushPayload, opts?: { onlyEndpoint?: string }) {
  if (!configure()) return

  const service = createServiceClient()
  let query = service.from('admin_push_subscriptions').select('id, endpoint, p256dh, auth')
  if (opts?.onlyEndpoint) query = query.eq('endpoint', opts.onlyEndpoint)
  const { data } = await query

  const dead: string[] = []
  await Promise.all(
    (data ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 3600, urgency: 'high' }
        )
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        // 404/410 = the device unsubscribed or the app was removed
        if (code === 404 || code === 410) dead.push(s.id)
      }
    })
  )

  if (dead.length) await service.from('admin_push_subscriptions').delete().in('id', dead)
}
