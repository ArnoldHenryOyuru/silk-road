'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Script from 'next/script'
import { Eye, ShieldCheck } from 'lucide-react'
import { signUp } from './actions'
import { normalizeUgandaPhone } from '@/lib/phone'
import styles from './sign-up.module.css'

const AFTER_SIGNUP_PATH = '/discover'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
        }
      ) => string
      reset: (widgetId?: string) => void
    }
  }
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default function SignUpForm({
  turnstileSiteKey,
  challengeToken,
}: {
  turnstileSiteKey: string | null
  challengeToken: string
}) {
  const router = useRouter()

  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [website, setWebsite] = useState('') // honeypot
  const [turnstileToken, setTurnstileToken] = useState('')
  const [touched, setTouched] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const turnstileBoxRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  function renderTurnstile() {
    if (!turnstileSiteKey || !turnstileBoxRef.current || !window.turnstile || widgetIdRef.current) {
      return
    }
    widgetIdRef.current = window.turnstile.render(turnstileBoxRef.current, {
      sitekey: turnstileSiteKey,
      callback: (token: string) => setTurnstileToken(token),
      'expired-callback': () => setTurnstileToken(''),
      'error-callback': () => setTurnstileToken(''),
    })
  }

  useEffect(() => {
    renderTurnstile()
  })

  const nameValid = displayName.trim().length >= 2 && displayName.trim().length <= 60
  const phoneValid = normalizeUgandaPhone(phone.trim()) !== null
  const emailValid = isValidEmail(email.trim())
  const passwordValid = password.length >= 8
  const allValid = nameValid && phoneValid && emailValid && passwordValid && agreed

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setTouched(true)
    setFormError(null)
    if (!allValid) return

    if (turnstileSiteKey && !turnstileToken) {
      setFormError('Complete the security check below to continue.')
      return
    }

    setPending(true)
    try {
      const formData = new FormData()
      formData.set('displayName', displayName.trim())
      formData.set('phone', phone.trim())
      formData.set('email', email.trim())
      formData.set('password', password)
      formData.set('terms', agreed ? '1' : '0')
      formData.set('website', website)
      formData.set('challengeToken', challengeToken)
      if (turnstileToken) {
        formData.set('cf-turnstile-response', turnstileToken)
      }

      const result = await signUp(formData)
      if ('error' in result) {
        setFormError(result.error)
        setPending(false)
        if (turnstileSiteKey && window.turnstile && widgetIdRef.current) {
          window.turnstile.reset(widgetIdRef.current)
          setTurnstileToken('')
        }
        return
      }
      router.push(AFTER_SIGNUP_PATH)
      router.refresh()
    } catch {
      setFormError('Something went wrong. Check your connection and try again.')
      setPending(false)
    }
  }

  return (
    <main className={styles.main}>
      {turnstileSiteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={renderTurnstile}
        />
      )}

      <h1>Create your account</h1>
      <p className={styles.subtitle}>Join in under a minute. You&apos;ll complete your profile after.</p>

      <form onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor="displayName">Your name</label>
          <input
            id="displayName"
            type="text"
            autoComplete="given-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="First name is fine"
            maxLength={60}
            className={touched && !nameValid ? styles.inputError : ''}
          />
          {touched && !nameValid && <div className={styles.fieldError}>Enter your name.</div>}
        </div>

        <div className={styles.field}>
          <label htmlFor="phone">WhatsApp number</label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07XX XXX XXX"
            className={touched && !phoneValid ? styles.inputError : ''}
          />
          {touched && !phoneValid ? (
            <div className={styles.fieldError}>Enter a valid Ugandan mobile number (e.g. 07XXXXXXXX).</div>
          ) : (
            <div className={styles.hint}>The number members use to reach you on WhatsApp.</div>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={touched && !emailValid ? styles.inputError : ''}
          />
          {touched && !emailValid && <div className={styles.fieldError}>Enter a valid email address.</div>}
        </div>

        <div className={styles.field}>
          <label htmlFor="password">Password</label>
          <div className={styles.inputWrap}>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className={touched && !passwordValid ? styles.inputError : ''}
            />
            <button
              type="button"
              className={styles.toggleVisibility}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((v) => !v)}
            >
              <Eye size={18} />
            </button>
          </div>
          {touched && !passwordValid && (
            <div className={styles.fieldError}>Password must be at least 8 characters.</div>
          )}
        </div>

        <div className={styles.hp} aria-hidden="true">
          <label htmlFor="hp-field">Leave this empty</label>
          <input
            id="hp-field"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <div className={styles.checkboxRow}>
          <input id="terms" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <label htmlFor="terms">
            I am 18 or older and I agree to the{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </a>
            .
          </label>
        </div>
        {touched && !agreed && <div className={styles.fieldError}>Please tick the box to continue.</div>}

        {turnstileSiteKey ? (
          <div style={{ margin: '12px 0' }} ref={turnstileBoxRef} />
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: 'var(--text-secondary)',
              margin: '8px 0 6px',
            }}
          >
            <ShieldCheck size={15} />
            <span>Protected against automated sign-ups</span>
          </div>
        )}

        {formError && <p className={styles.fieldError}>{formError}</p>}

        <button className={styles.primaryBtn} type="submit" disabled={pending}>
          {pending ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <div className={styles.switchRow}>
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </div>
    </main>
  )
}
