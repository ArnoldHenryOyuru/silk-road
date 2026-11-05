'use client'

import { useEffect, useState } from 'react'
import { savePushSubscription, removePushSubscription } from '@/app/admin/actions'
import styles from '@/app/admin/(protected)/admin.module.css'

type State = 'loading' | 'unsupported' | 'install' | 'off' | 'on' | 'denied'

function urlBase64ToBuffer(b64: string) {
  const padded = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0)).buffer as ArrayBuffer
}

export default function EnablePush() {
  const [state, setState] = useState<State>('loading')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    ;(async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true

      // iPhone Safari only exposes push once the site is added to the Home Screen
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setState(ios && !standalone ? 'install' : 'unsupported')
        return
      }
      if (Notification.permission === 'denied') return setState('denied')

      const reg = await navigator.serviceWorker.getRegistration('/admin')
      const sub = await reg?.pushManager.getSubscription()
      setState(sub ? 'on' : 'off')
    })()
  }, [])

  async function enable() {
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!key) return alert('Push is not configured yet (missing VAPID public key).')

    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.register('/admin-sw.js', { scope: '/admin' })
      await navigator.serviceWorker.ready

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return setState('denied')

      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBuffer(key) }))

      const json = sub.toJSON()
      const res = await savePushSubscription(
        { endpoint: json.endpoint!, p256dh: json.keys!.p256dh, auth: json.keys!.auth },
        navigator.userAgent
      )
      setState(res.ok ? 'on' : 'off')
    } catch (e) {
      console.error(e)
      alert('Could not turn on notifications. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration('/admin')
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await removePushSubscription(sub.endpoint)
        await sub.unsubscribe()
      }
      setState('off')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading' || state === 'unsupported') return null

  if (state === 'install') {
    return (
      <button
        type="button"
        className={styles.logout}
        onClick={() =>
          alert('On iPhone: open this page in Safari, tap Share, then "Add to Home Screen". Open Silk Road Admin from your home screen and tap Enable alerts.')
        }
      >
        Enable alerts
      </button>
    )
  }

  if (state === 'denied') {
    return (
      <button
        type="button"
        className={styles.logout}
        onClick={() => alert('Notifications are blocked. On iPhone go to Settings > Notifications > Silk Road Admin and allow them.')}
      >
        Alerts blocked
      </button>
    )
  }

  return (
    <button
      type="button"
      disabled={busy}
      className={`${styles.logout} ${state === 'on' ? styles.alertsOn : ''}`}
      onClick={state === 'on' ? disable : enable}
    >
      {busy ? '…' : state === 'on' ? 'Alerts on' : 'Enable alerts'}
    </button>
  )
}
