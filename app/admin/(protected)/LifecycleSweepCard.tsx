'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle2 } from 'lucide-react'
import { triggerLifecycleSweep } from './actions'
import type { LifecycleSweepResult } from '@/lib/lifecycle/sweep'
import styles from './admin.module.css'

export default function LifecycleSweepCard() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<LifecycleSweepResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleRun() {
    setBusy(true)
    setError(null)
    const res = await triggerLifecycleSweep()
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setResult(res.summary)
  }

  return (
    <section className={styles.panel} style={{ marginTop: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h3 className={styles.panelTitle} style={{ marginBottom: 4 }}>
            Lifecycle maintenance
          </h3>
          <p className={styles.panelSub} style={{ marginBottom: 0 }}>
            Send 24-hour draft checklist reminders and expire paused plans past their 14-day recovery window.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRun}
          disabled={busy}
          className={`${styles.btn} ${styles.view}`}
          style={{ gap: 8, padding: '9px 16px' }}
        >
          <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
          {busy ? 'Running sweep…' : 'Run lifecycle sweep'}
        </button>
      </div>

      {error && (
        <p className={styles.fieldError} style={{ marginTop: 10 }}>
          {error}
        </p>
      )}

      {result && (
        <div
          style={{
            marginTop: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12.5,
            color: 'var(--success)',
          }}
        >
          <CheckCircle2 size={15} />
          <span>
            Sweep complete: {result.draftNudgesSent} draft reminder{result.draftNudgesSent === 1 ? '' : 's'} sent,{' '}
            {result.expiredSubscriptions} paused subscription{result.expiredSubscriptions === 1 ? '' : 's'} expired.
          </span>
        </div>
      )}
    </section>
  )
}
