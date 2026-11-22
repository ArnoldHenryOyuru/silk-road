'use client'

import { useState, useRef, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfile } from './actions'
import { normalizeUgandaPhone } from '@/lib/phone'
import styles from './edit-profile.module.css'

const CAMPUS_OPTIONS = ['Makerere University', 'MUBS', 'Kyambogo University', 'Other']
const LOOKING_FOR_OPTIONS = ['Friends', 'Dating', 'Something casual']
const SHOW_ME_OPTIONS = ['Men', 'Women', 'Everyone']

export interface ExistingPhoto {
  id: string
  url: string
  isPrimary: boolean
  isPending: boolean
}

export interface EditProfileInitialData {
  displayName: string
  dob: string
  campus: string
  phone: string
  lookingFor: string | null
  showMe: string | null
  bio: string
  interests: string[]
  photos: ExistingPhoto[]
  isDiscoverable: boolean
  teaserOptIn: boolean
}

type Slot =
  | { kind: 'existing'; id: string; url: string; isPrimary: boolean; isPending: boolean }
  | { kind: 'new'; file: File; previewUrl: string }
  | null

const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)
const PlusIcon = () => (
  <svg className={styles.plusIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)
const RemoveIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)
const WarnIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
)

export default function EditProfileForm({ initial }: { initial: EditProfileInitialData }) {
  const router = useRouter()

  const [name, setName] = useState(initial.displayName)
  const [dob, setDob] = useState(initial.dob)
  const [campus, setCampus] = useState(initial.campus)
  const [phone, setPhone] = useState(initial.phone)
  const [lookingFor, setLookingFor] = useState<string | null>(initial.lookingFor)
  const [showMe, setShowMe] = useState<string | null>(initial.showMe)
  const [bio, setBio] = useState(initial.bio)
  const [interests, setInterests] = useState<string[]>(initial.interests)
  const [interestInput, setInterestInput] = useState('')
  const [isDiscoverable, setIsDiscoverable] = useState(initial.isDiscoverable)
  const [teaserOptIn, setTeaserOptIn] = useState(initial.isDiscoverable && initial.teaserOptIn)

  const initialSlots: Slot[] = initial.photos
    .slice()
    .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
    .map((p) => ({ kind: 'existing', id: p.id, url: p.url, isPrimary: p.isPrimary, isPending: p.isPending }))
  while (initialSlots.length < 6) initialSlots.push(null)

  const [slots, setSlots] = useState<Slot[]>(initialSlots)
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeSlotIndexRef = useRef<number | null>(null)

  function markDirty() {
    setDirty(true)
  }

  function triggerUpload(index: number) {
    activeSlotIndexRef.current = index
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const index = activeSlotIndexRef.current
    if (!file || index === null) {
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setSlots((prev) => {
        const next = [...prev]
        next[index] = { kind: 'new', file, previewUrl: reader.result as string }
        return next
      })
      markDirty()
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function removeSlot(index: number) {
    setSlots((prev) => {
      const slot = prev[index]
      if (slot?.kind === 'existing') {
        setRemovedIds((ids) => [...ids, slot.id])
      }
      const next = [...prev]
      next[index] = null
      return next
    })
    markDirty()
  }

  function addInterest() {
    const v = interestInput.trim()
    if (v && interests.length < 6 && !interests.includes(v)) {
      setInterests((prev) => [...prev, v])
      setInterestInput('')
      markDirty()
    }
  }
  function handleInterestKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addInterest()
    }
  }
  function removeInterest(index: number) {
    setInterests((prev) => prev.filter((_, i) => i !== index))
    markDirty()
  }

  const hasPendingPhoto = slots.some((s) => s?.kind === 'existing' && s.isPending)

  async function handleSave() {
    setError(null)

    if (!normalizeUgandaPhone(phone)) {
      setError('Enter a valid Ugandan mobile number (e.g. 07XXXXXXXX).')
      return
    }

    setSaving(true)

    const formData = new FormData()
    formData.set('displayName', name)
    formData.set('dob', dob)
    formData.set('campus', campus)
    formData.set('phone', phone)
    formData.set('lookingFor', lookingFor ?? '')
    formData.set('showMe', showMe ?? '')
    formData.set('bio', bio)
    formData.set('visibility', isDiscoverable ? 'discoverable' : 'discreet')
    formData.set('teaserOptIn', isDiscoverable && teaserOptIn ? '1' : '0')
    interests.forEach((tag) => formData.append('interests', tag))
    removedIds.forEach((id) => formData.append('removedPhotoIds', id))

    slots.forEach((slot, i) => {
      if (!slot) return
      if (slot.kind === 'existing') {
        formData.append('slotOrder', `existing:${slot.id}`)
      } else {
        formData.append('slotOrder', `new:${i}`)
        formData.append(`newPhoto:${i}`, slot.file)
      }
    })

    const result = await updateProfile(formData)
    setSaving(false)

    if (result?.error) {
      setError(result.error)
      return
    }
    setDirty(false)
    router.push('/profile')
  }

  function handleDiscard() {
    router.push('/profile')
  }

  return (
    <main className={styles.main}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className={styles.hiddenFileInput}
        onChange={handleFileChange}
      />

      <div className={styles.backLink} onClick={() => router.push('/profile')}>
        <BackIcon /> Back to Profile
      </div>

      <h1>Edit Profile</h1>
      <p className={styles.subtitle}>
        Changes to your photo or bio go through a quick review before they&apos;re visible on Discover. Everything else
        updates right away.
      </p>

      {dirty && (
        <div className={styles.unsavedPill}>
          <WarnIcon /> You have unsaved changes
        </div>
      )}

      <div className={styles.sectionLabel}>Photos</div>
      <div className={styles.photoGrid}>
        {slots.map((slot, i) => (
          <div key={i} className={`${styles.photoSlot} ${!slot ? styles.empty : ''}`} onClick={() => !slot && triggerUpload(i)}>
            {slot ? (
              <>
                <img src={slot.kind === 'existing' ? slot.url : slot.previewUrl} alt="" />
                {i === 0 && <span className={`${styles.photoTag} ${styles.main}`}>Main</span>}
                {slot.kind === 'existing' && slot.isPending && (
                  <span className={`${styles.photoTag} ${styles.pending}`} style={{ left: i === 0 ? 46 : 5 }}>
                    In review
                  </span>
                )}
                <button
                  className={styles.removeBtn}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeSlot(i)
                  }}
                >
                  <RemoveIcon />
                </button>
              </>
            ) : (
              <PlusIcon />
            )}
          </div>
        ))}
      </div>
      {hasPendingPhoto && (
        <p className={styles.photoHint}>
          A photo you changed recently is still being reviewed — it won&apos;t show on Discover until it&apos;s approved.
        </p>
      )}

      <div className={styles.reviewNotice}>
        <WarnIcon />
        <div>
          Swapping your main photo or editing your bio triggers a quick re-review (usually a few hours). Campus,
          age, and preferences update instantly.
        </div>
      </div>

      <div className={styles.sectionLabel}>The basics</div>
      <div className={styles.field}>
        <label>Display name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            markDirty()
          }}
        />
      </div>
      <div className={styles.row}>
        <div className={styles.field}>
          <label>Date of birth</label>
          <input
            type="date"
            value={dob}
            onChange={(e) => {
              setDob(e.target.value)
              markDirty()
            }}
          />
        </div>
        <div className={styles.field}>
          <label>Campus</label>
          <select
            value={campus}
            onChange={(e) => {
              setCampus(e.target.value)
              markDirty()
            }}
          >
            {CAMPUS_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.field}>
        <label>WhatsApp number</label>
        <input
          type="text"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value)
            markDirty()
          }}
          placeholder="07XXXXXXXX"
        />
      </div>

      <div className={styles.field}>
        <label>Looking for</label>
        <div className={styles.chipGroup}>
          {LOOKING_FOR_OPTIONS.map((opt) => (
            <div
              key={opt}
              className={`${styles.chipOption} ${lookingFor === opt ? styles.selected : ''}`}
              onClick={() => {
                setLookingFor(opt)
                markDirty()
              }}
            >
              {opt}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.field}>
        <label>Show me</label>
        <div className={styles.chipGroup}>
          {SHOW_ME_OPTIONS.map((opt) => (
            <div
              key={opt}
              className={`${styles.chipOption} ${showMe === opt ? styles.selected : ''}`}
              onClick={() => {
                setShowMe(opt)
                markDirty()
              }}
            >
              {opt}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.sectionLabel}>About you</div>
      <div className={styles.field}>
        <label>Bio</label>
        <textarea
          value={bio}
          onChange={(e) => {
            setBio(e.target.value.slice(0, 220))
            markDirty()
          }}
        />
        <div className={styles.charCount}>{bio.length}/220</div>
      </div>

      <div className={styles.field}>
        <label>Interests</label>
        <div className={styles.interestInputRow}>
          <input
            type="text"
            value={interestInput}
            onChange={(e) => setInterestInput(e.target.value)}
            onKeyDown={handleInterestKeyDown}
            placeholder="e.g. Music, Hiking"
          />
          <button className={styles.addInterestBtn} onClick={addInterest} type="button">
            +
          </button>
        </div>
        <div className={styles.interestChips}>
          {interests.map((tag, i) => (
            <span key={tag} className={styles.interestChip}>
              {tag}
              <button onClick={() => removeInterest(i)} type="button">
                <RemoveIcon />
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className={styles.sectionLabel}>Privacy</div>
      <div className={styles.visibilityGroup} role="radiogroup" aria-label="Profile visibility">
        <button
          type="button"
          role="radio"
          aria-checked={isDiscoverable}
          className={`${styles.visibilityOption} ${isDiscoverable ? styles.selected : ''}`}
          onClick={() => {
            setIsDiscoverable(true)
            markDirty()
          }}
        >
          <div className={styles.visibilityTitle}>Listed on Discover</div>
          <div className={styles.visibilitySub}>Other members can find your profile in the Discover feed.</div>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={!isDiscoverable}
          className={`${styles.visibilityOption} ${!isDiscoverable ? styles.selected : ''}`}
          onClick={() => {
            setIsDiscoverable(false)
            setTeaserOptIn(false)
            markDirty()
          }}
        >
          <div className={styles.visibilityTitle}>Discreet</div>
          <div className={styles.visibilitySub}>
            You won&apos;t appear on Discover or the public homepage. You can still browse everyone else&apos;s profile.
          </div>
        </button>
      </div>
      {isDiscoverable && (
        <label className={styles.teaserCheck}>
          <input
            type="checkbox"
            checked={teaserOptIn}
            onChange={(e) => {
              setTeaserOptIn(e.target.checked)
              markDirty()
            }}
          />
          <span>
            Show my main photo, first name, age and campus on Silk Road&apos;s public homepage. Anyone can see it, even
            without an account.
          </span>
        </label>
      )}
      <p className={styles.visibilityHint}>Switching to Discreet takes effect as soon as you save.</p>

      {error && <p className={styles.fieldError}>{error}</p>}

      <div className={styles.saveBar}>
        <div className={styles.saveBarInner}>
          <button className={styles.discardBtn} onClick={handleDiscard} type="button">
            Discard
          </button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </main>
  )
}
