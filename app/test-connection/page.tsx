'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/browser'

export default function TestConnectionPage() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'error'>('checking')
  const [detail, setDetail] = useState('')

  useEffect(() => {
    const supabase = createClient()

    // getSession() just asks Supabase "are you there and do my keys work?" —
    // it doesn't need any tables to exist yet.
    supabase.auth.getSession().then(({ error }) => {
      if (error) {
        setStatus('error')
        setDetail(error.message)
      } else {
        setStatus('ok')
      }
    })
  }, [])

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>Supabase connection test</h1>
      {status === 'checking' && <p>Checking…</p>}
      {status === 'ok' && <p style={{ color: 'green' }}>✅ Connected to Supabase successfully.</p>}
      {status === 'error' && (
        <p style={{ color: 'red' }}>❌ Something's wrong: {detail}</p>
      )}
    </div>
  )
}
