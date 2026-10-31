'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn } from './actions'
import { requestPasswordReset } from '../forgot-password/actions'
import { SUPPORT_EMAIL } from '@/lib/constants'
import styles from './sign-in.module.css'

type Step = 'signin' | 'forgot' | 'sent'
type BannerKind = 'warn' | 'info' | 'danger'
type BannerReason = 'pending_deletion' | 'suspended' | 'banned'

const InfoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
)

const BanIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="4.9" y1="4.9" x2="19.1" y2="19.1" />
  </svg>
)

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

export default function SignInPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('signin')

  // Sign-in step state
  const [showPassword, setShowPassword] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ kind: BannerKind; reason: BannerReason; message: string } | null>(null)
  const [pending, setPending] = useState(false)

  // Forgot-password step state
  const [resetEmail, setResetEmail] = useState('')
  const [resetPending, setResetPending] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  async function handleSignIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFieldError(null)
    setBanner(null)
    setPending(true)

    const result = await signIn(new FormData(e.currentTarget))

    setPending(false)

    if ('error' in result) {
      // Match the message to a banner where the mockup calls for one;
      // everything else (wrong password) is the plain field error.
      if (result.error.includes('pending deletion')) {
        setBanner({ kind: 'warn', reason: 'pending_deletion', message: result.error })
      } else if (result.error.includes('suspended')) {
        setBanner({ kind: 'warn', reason: 'suspended', message: result.error })
      } else if (result.error.includes('banned')) {
        setBanner({ kind: 'danger', reason: 'banned', message: result.error })
      } else {
        setFieldError(result.error)
      }
      return
    }

    router.push(result.redirectTo)
  }

  async function handleSendReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setResetError(null)
    setResetPending(true)

    const email = String(new FormData(e.currentTarget).get('resetEmail') || '').trim()
    const result = await requestPasswordReset(email)

    setResetPending(false)
    if (result && 'error' in result) {
      setResetError(result.error ?? 'Something went wrong. Please try again.')
      return
    }
    setResetEmail(email)
    setStep('sent')
  }

  if (step === 'sent') {
    return (
      <main className={styles.main}>
        <div className={styles.successWrap}>
          <div className={styles.successBadge}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 6 12 13 2 6" />
              <rect x="2" y="4" width="20" height="16" rx="2" />
            </svg>
          </div>
          <h1>Check your email</h1>
          <p className={styles.subtitle}>
            If an account exists for <strong>{resetEmail}</strong>, a reset link is on its way.
          </p>
          <button className={styles.primaryBtn} onClick={() => setStep('signin')}>
            Back to sign in
          </button>
        </div>
      </main>
    )
  }

  if (step === 'forgot') {
    return (
      <main className={styles.main}>
        <div className={styles.backLink} onClick={() => setStep('signin')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to sign in
        </div>
        <h1>Reset your password</h1>
        <p className={styles.subtitle}>Enter your email and we'll send a reset link. It expires in 30 minutes.</p>

        <form onSubmit={handleSendReset}>
          <div className={styles.field}>
            <label>Email</label>
            <input type="email" name="resetEmail" placeholder="you@example.com" required />
          </div>
          {resetError && <p className={styles.fieldError}>{resetError}</p>}
          <button className={styles.primaryBtn} type="submit" disabled={resetPending}>
            {resetPending ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      </main>
    )
  }

  return (
    <main className={styles.main}>
      <h1>Welcome back</h1>
      <p className={styles.subtitle}>Sign in to keep browsing verified students near you.</p>

      {banner && (
        <div className={`${styles.statusBanner} ${styles[banner.kind]}`}>
          {banner.kind === 'danger' ? <BanIcon /> : <InfoIcon />}
          <div className={styles.bannerText}>
            {banner.reason === 'suspended' && (
              <>
                Account suspended.{' '}
                <a href={`mailto:${SUPPORT_EMAIL}?subject=Suspended account`}>Contact support</a> if you
                believe this is a mistake.
              </>
            )}
            {banner.reason === 'banned' && (
              <>
                This account has been banned.{' '}
                <a href={`mailto:${SUPPORT_EMAIL}?subject=Ban appeal`}>You can appeal this decision</a>.
              </>
            )}
            {banner.reason === 'pending_deletion' && banner.message}
          </div>
        </div>
      )}

      <form onSubmit={handleSignIn}>
        <div className={styles.field}>
          <label>Email</label>
          <input type="email" name="email" placeholder="you@example.com" required autoComplete="email" />
        </div>

        <div className={styles.field}>
          <label>Password</label>
          <div className={styles.inputWrap}>
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              placeholder="Your password"
              required
              autoComplete="current-password"
              className={fieldError ? styles.inputError : ''}
            />
            <button
              type="button"
              className={styles.toggleVisibility}
              aria-label="Show password"
              onClick={() => setShowPassword((v) => !v)}
            >
              <EyeIcon />
            </button>
          </div>
          {fieldError && <div className={styles.fieldError}>{fieldError}</div>}
        </div>

        <div className={styles.forgotRow}>
          <a onClick={() => setStep('forgot')}>Forgot password?</a>
        </div>

        <button className={styles.primaryBtn} type="submit" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className={styles.switchRow}>
        New to Silk Road? <Link href="/sign-up">Create an account</Link>
      </div>
    </main>
  )
}
