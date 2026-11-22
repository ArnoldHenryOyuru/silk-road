'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { requestRejectionRefund } from './actions'

export default function RefundRequestButton({ subscriptionId }: { subscriptionId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleConfirm() {
    setError(null)
    setPending(true)
    const res = await requestRejectionRefund(subscriptionId)
    setPending(false)
    if ('error' in res && res.error) {
      setError(res.error)
      return
    }
    setDone(true)
    router.refresh()
  }

  if (done) {
    return (
      <p style={{ fontSize: 13, color: 'var(--success)', fontWeight: 700, margin: '8px 0 0' }}>
        Refund request submitted. Our team will process it shortly.
      </p>
    )
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        style={{
          width: '100%',
          height: 44,
          borderRadius: 12,
          border: '1.5px solid var(--border)',
          background: 'transparent',
          color: 'var(--text-primary)',
          fontSize: 13.5,
          fontWeight: 700,
          cursor: 'pointer',
          marginTop: 10,
        }}
      >
        Request refund instead
      </button>
    )
  }

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
      }}
    >
      <p style={{ fontSize: 12.5, margin: '0 0 10px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        Requesting a refund cancels your paused plan and queues your payment for refund. Are you sure?
      </p>
      {error && <p style={{ fontSize: 12, color: 'var(--danger)', margin: '0 0 8px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={pending}
          style={{
            flex: 1,
            height: 40,
            borderRadius: 10,
            border: 'none',
            background: 'var(--danger)',
            color: 'white',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {pending ? 'Submitting…' : 'Confirm refund'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          style={{
            flex: 1,
            height: 40,
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--background)',
            color: 'var(--text-primary)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
