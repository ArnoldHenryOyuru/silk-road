'use client'

import type { CSSProperties } from 'react'

// Inline styles on purpose: they use your existing theme variables, so this
// works in both the Subscribe page and the profile modal without touching CSS files.
const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
  margin: '0 0 8px',
}
const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  height: 48,
  borderRadius: 12,
  border: '1.5px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text-primary)',
  padding: '0 14px',
  fontSize: 15,
  fontFamily: 'inherit',
}
const hintStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--text-secondary)',
  marginTop: 6,
  lineHeight: 1.5,
}

export default function PhoneField({
  value,
  onChange,
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div style={{ margin: '0 0 16px' }}>
      <label htmlFor="pay-phone" style={labelStyle}>
        Mobile money number
      </label>
      <input
        id="pay-phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="07XXXXXXXX"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={inputStyle}
      />
      <div style={hintStyle}>MTN or Airtel. You&apos;ll get an approval prompt on this number.</div>
    </div>
  )
}
