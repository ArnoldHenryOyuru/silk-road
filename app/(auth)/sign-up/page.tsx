'use client'

import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signUp } from './actions'
import { verifyEmailOtp, resendOtp } from '../verify-email/actions'
import styles from './sign-up.module.css'

type Step = 'details' | 'otp' | 'success'

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default function SignUpPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('details')

  // Step 1: account details
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [termsAgreed, setTermsAgreed] = useState(false)
  const [touched, setTouched] = useState(false)
  const [signUpError, setSignUpError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const emailValid = isValidEmail(email)
  const passwordValid = password.length >= 8
  const canContinue = emailValid && passwordValid && ageConfirmed && termsAgreed

  // Step 2: OTP
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(''))
  const otpRefs = useRef<Array<HTMLInputElement | null>>([])
  const [otpError, setOtpError] = useState<string | null>(null)
  const [otpPending, setOtpPending] = useState(false)
  const [resendSeconds, setResendSeconds] = useState(0)

  useEffect(() => {
    if (resendSeconds <= 0) return
    const timer = setInterval(() => setResendSeconds((s) => s - 1), 1000)
    return () => clearInterval(timer)
  }, [resendSeconds])

  async function handleContinue(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setTouched(true)
    setSignUpError(null)
    if (!canContinue) return

    setPending(true)
    const formData = new FormData()
    formData.set('email', email)
    formData.set('password', password)
    const result = await signUp(formData)
    setPending(false)

    if ('error' in result) {
      setSignUpError(result.error)
      return
    }
    setResendSeconds(30)
    setStep('otp')
  }

  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/[^0-9]/g, '').slice(-1)
    setOtpDigits((prev) => {
      const next = [...prev]
      next[index] = digit
      return next
    })
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  function handleOtpKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  async function handleVerify() {
    setOtpError(null)
    const token = otpDigits.join('')
    if (token.length < 6) {
      setOtpError('Enter all 6 digits.')
      return
    }

    setOtpPending(true)
    const result = await verifyEmailOtp(email, token)
    setOtpPending(false)

    if ('error' in result) {
      setOtpError(result.error ?? 'Verification failed. Please try again.')
      return
    }
    setStep('success')
  }

  async function handleResend() {
    if (resendSeconds > 0) return
    const result = await resendOtp(email)
    if ('error' in result) {
      setOtpError(result.error ?? 'Could not resend the code. Please try again.')
      return
    }
    setResendSeconds(30)
  }

  if (step === 'success') {
    return (
      <main className={styles.main}>
        <div className={styles.progressTrack}>
          <div className={`${styles.progressSeg} ${styles.done}`} />
          <div className={`${styles.progressSeg} ${styles.done}`} />
          <div className={`${styles.progressSeg} ${styles.done}`} />
        </div>
        <div className={styles.successWrap}>
          <div className={styles.successBadge}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1>Email verified</h1>
          <p className={styles.subtitle}>
            Let's set up your profile — photos, campus, and a short bio so people know who you are.
          </p>
          <button className={styles.primaryBtn} onClick={() => router.push('/onboarding/profile')}>
            Set up my profile
          </button>
        </div>
      </main>
    )
  }

  if (step === 'otp') {
    return (
      <main className={styles.main}>
        <div className={styles.progressTrack}>
          <div className={`${styles.progressSeg} ${styles.done}`} />
          <div className={`${styles.progressSeg} ${styles.done}`} />
          <div className={styles.progressSeg} />
        </div>
        <div className={styles.backLink} onClick={() => setStep('details')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </div>
        <h1>Check your email</h1>
        <p className={styles.subtitle}>
          Enter the 6-digit code we sent to <span className={styles.emailChip}>{email}</span>
        </p>

        <div className={styles.otpRow}>
          {otpDigits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => {
                otpRefs.current[i] = el
              }}
              className={styles.otpBox}
              maxLength={1}
              inputMode="numeric"
              value={digit}
              onChange={(e) => handleOtpChange(i, e.target.value)}
              onKeyDown={(e) => handleOtpKeyDown(i, e)}
            />
          ))}
        </div>

        {otpError && <p className={styles.fieldError}>{otpError}</p>}

        <button className={styles.primaryBtn} onClick={handleVerify} disabled={otpPending}>
          {otpPending ? 'Verifying…' : 'Verify email'}
        </button>

        <div className={styles.resendRow}>
          Didn't get it?{' '}
          <span
            className={`${styles.resendLink} ${resendSeconds > 0 ? styles.disabled : ''}`}
            onClick={handleResend}
          >
            {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend code'}
          </span>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.main}>
      <div className={styles.progressTrack}>
        <div className={`${styles.progressSeg} ${styles.done}`} />
        <div className={styles.progressSeg} />
        <div className={styles.progressSeg} />
      </div>

      <h1>Create your account</h1>
      <p className={styles.subtitle}>Every account here is verified. Starting with yours.</p>

      <form onSubmit={handleContinue}>
        <div className={styles.field}>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={touched && !emailValid ? styles.inputError : ''}
          />
          {touched && !emailValid && <div className={styles.fieldError}>Enter a valid email address.</div>}
        </div>

        <div className={styles.field}>
          <label>Password</label>
          <div className={styles.inputWrap}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className={touched && !passwordValid ? styles.inputError : ''}
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
          {touched && !passwordValid && (
            <div className={styles.fieldError}>Password must be at least 8 characters.</div>
          )}
        </div>

        <div className={styles.checkboxRow}>
          <input
            type="checkbox"
            id="ageCheck"
            checked={ageConfirmed}
            onChange={(e) => setAgeConfirmed(e.target.checked)}
          />
          <label htmlFor="ageCheck">I confirm I am 18 years of age or older.</label>
        </div>
        <div className={styles.checkboxRow}>
          <input
            type="checkbox"
            id="termsCheck"
            checked={termsAgreed}
            onChange={(e) => setTermsAgreed(e.target.checked)}
          />
          <label htmlFor="termsCheck">
            I agree to the{' '}
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

        {signUpError && <p className={styles.fieldError}>{signUpError}</p>}

        <button className={styles.primaryBtn} type="submit" disabled={!canContinue || pending}>
          {pending ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <div className={styles.switchRow}>
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </div>
    </main>
  )
}
