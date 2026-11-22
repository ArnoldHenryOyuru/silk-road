'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { sendVerificationCode, confirmVerificationCode } from '@/app/(auth)/verify-email/otp-actions'
import styles from './EmailVerifyModal.module.css'

function EmailVerifyModalDialog({
  email,
  onClose,
  onVerified,
}: {
  email?: string | null
  onClose: () => void
  onVerified: () => void
}) {
  const [code, setCode] = useState('')
  const [sentEmail, setSentEmail] = useState(email ?? '')
  const [sandboxCode, setSandboxCode] = useState<string | null>(null)
  const [sending, setSending] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  async function requestCode() {
    setError(null)
    setSending(true)
    const res = await sendVerificationCode()
    setSending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setSentEmail(res.email)
    setSandboxCode(res.sandboxCode ?? null)
    setCooldown(60)
  }

  useEffect(() => {
    let active = true
    sendVerificationCode().then((res) => {
      if (!active) return
      setSending(false)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setSentEmail(res.email)
      setSandboxCode(res.sandboxCode ?? null)
      setCooldown(60)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function handleVerify(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code.')
      return
    }
    setVerifying(true)
    const res = await confirmVerificationCode(code.trim())
    setVerifying(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    onVerified()
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.card} role="dialog" aria-modal="true" aria-labelledby="otp-modal-title">
        <div className={styles.head}>
          <h2 id="otp-modal-title" className={styles.title}>
            Verify your email
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <p className={styles.sub}>
          Enter the 6-digit verification code sent to{' '}
          <strong>{sentEmail || email || 'your email'}</strong>.
        </p>

        {sandboxCode && (
          <div className={styles.sandboxBox}>
            <span>Test mode code (email delivery unset):</span>
            <span className={styles.sandboxCode}>{sandboxCode}</span>
          </div>
        )}

        <form onSubmit={handleVerify}>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className={styles.codeInput}
            aria-label="6-digit verification code"
            autoFocus
          />

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button type="submit" className={styles.primaryBtn} disabled={verifying || code.length !== 6}>
              {verifying ? 'Verifying…' : 'Verify email'}
            </button>
            <button
              type="button"
              className={styles.resendBtn}
              disabled={sending || cooldown > 0}
              onClick={requestCode}
            >
              {sending ? 'Sending…' : cooldown > 0 ? `Resend code in ${cooldown}s` : 'Send a new code'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function EmailVerifyModal({
  open,
  email,
  onClose,
  onVerified,
}: {
  open: boolean
  email?: string | null
  onClose: () => void
  onVerified: () => void
}) {
  if (!open) return null
  return <EmailVerifyModalDialog email={email} onClose={onClose} onVerified={onVerified} />
}
