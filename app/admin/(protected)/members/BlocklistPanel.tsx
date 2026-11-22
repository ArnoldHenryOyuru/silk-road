'use client'

import { useState, type FormEvent } from 'react'
import { addBlockedNumber, removeBlockedNumber, type BlockedNumberRow } from './actions'
import styles from '../admin.module.css'

function formatDisplayPhone(digits: string) {
  const clean = digits.replace(/^\+/, '')
  if (clean.startsWith('256') && clean.length === 12) {
    return `+${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)} ${clean.slice(9)}`
  }
  return digits
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Kampala',
  })
}

export default function BlocklistPanel({ initialNumbers }: { initialNumbers: BlockedNumberRow[] }) {
  const [items, setItems] = useState<BlockedNumberRow[]>(initialNumbers)
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!phone.trim() || saving) return
    setSaving(true)
    setError(null)
    const res = await addBlockedNumber(phone, reason)
    setSaving(false)
    if (res.error) {
      setError(res.error)
      return
    }
    if (res.item) {
      setItems((prev) => [res.item!, ...prev])
      setPhone('')
      setReason('')
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id)
    setError(null)
    const res = await removeBlockedNumber(id)
    setRemovingId(null)
    if (res.error) {
      setError(res.error)
      return
    }
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <section className={`${styles.panel} ${styles.sectionBlock}`}>
      <h2 className={styles.panelTitle}>WhatsApp number blocklist</h2>
      <p className={styles.panelSub}>
        Blocked numbers cannot sign up, submit a profile, or switch into an existing account.
      </p>

      <form onSubmit={handleAdd} className={styles.panelFormRow}>
        <input
          type="tel"
          className={styles.searchInput}
          placeholder="07XXXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={saving}
        />
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={240}
          disabled={saving}
        />
        <button type="submit" className={`${styles.btn} ${styles.reject}`} disabled={saving || !phone.trim()}>
          {saving ? 'Blocking…' : 'Block number'}
        </button>
      </form>

      {error && <p className={styles.fieldError}>{error}</p>}

      {items.length === 0 ? (
        <p className={styles.tableNote}>No WhatsApp numbers are currently blocklisted.</p>
      ) : (
        <div className={styles.tableWrap} style={{ marginTop: 16 }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>WhatsApp number</th>
                <th>Reason</th>
                <th>Blocked</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className={styles.cellName}>{formatDisplayPhone(item.phoneNumber)}</td>
                  <td className={styles.cellMuted}>{item.reason}</td>
                  <td className={styles.cellMuted}>{fmtDate(item.createdAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.view}`}
                      onClick={() => handleRemove(item.id)}
                      disabled={removingId === item.id}
                    >
                      {removingId === item.id ? 'Removing…' : 'Unblock'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
