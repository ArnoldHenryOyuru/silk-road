'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Re-checks the payment every few seconds while it is still pending. */
export default function PendingPoller({ intervalMs = 5000, maxMs = 120_000 }: { intervalMs?: number; maxMs?: number }) {
  const router = useRouter()

  useEffect(() => {
    const startedAt = Date.now()
    const id = setInterval(() => {
      if (Date.now() - startedAt > maxMs) {
        clearInterval(id)
        return
      }
      router.refresh()
    }, intervalMs)
    return () => clearInterval(id)
  }, [router, intervalMs, maxMs])

  return null
}
