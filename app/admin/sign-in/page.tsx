'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { adminSignIn } from './actions'
import styles from './admin-sign-in.module.css'

export default function AdminSignInPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)

    const result = await adminSignIn(new FormData(e.currentTarget))

    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    router.push('/admin')
  }

  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <div className={styles.wordmark}>SILK ROAD ADMIN</div>
        <h1>Sign in</h1>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div>
            <label>Email</label>
            <input type="email" name="email" required autoComplete="email" />
          </div>
          <div>
            <label>Password</label>
            <input type="password" name="password" required autoComplete="current-password" />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
