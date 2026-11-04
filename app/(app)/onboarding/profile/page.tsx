'use client'

import { useState, useRef, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createProfile } from './actions'
import { normalizeUgandaPhone } from '@/lib/phone'
import { compressImage } from '@/lib/compress-image'
import styles from './onboarding.module.css'

type Step = 1 | 2 | 3 | 4 | 5

const CAMPUS_OPTIONS = ['Makerere University', 'MUBS', 'Kyambogo University', 'Other']
const LOOKING_FOR_OPTIONS = ['Friends', 'Dating', 'Something casual']
const SHOW_ME_OPTIONS = ['Men', 'Women', 'Everyone']

// Vercel rejects request bodies over ~4.5 MB, so photos are shrunk when picked
// and the total is checked before submitting. Keep MAX_PHOTO_BYTES in line with
// MAX_FILE_BYTES in actions.ts.
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_PHOTO_BYTES = 3 * 1024 * 1024
const MAX_TOTAL_BYTES = 4.2 * 1024 * 1024

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
const SelfieIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
  </svg>
)
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
const DotIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
    <circle cx="12" cy="12" r="1" />
  </svg>
)

export default function CreateProfilePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)

  // Step 1: basics
  const [name, setName] = useState('')
  const [dob, setDob] = useState('')
  const [campus, setCampus] = useState('')
  const [phone, setPhone] = useState('')
  const [lookingFor, setLookingFor] = useState<string | null>(null)
  const [showMe, setShowMe] = useState<string | null>(null)

  // Step 2: about
  const [bio, setBio] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [interestInput, setInterestInput] = useState('')

  // Step 3: photos + selfie
  const [photos, setPhotos] = useState<Array<File | null>>(Array(6).fill(null))
  const [photoPreviews, setPhotoPreviews] = useState<Array<string | null>>(Array(6).fill(null))
  const [selfie, setSelfie] = useState<File | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeSlotRef = useRef<number | 'selfie' | null>(null)

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)

  // Step 4: who can find me
  const [visibility, setVisibility] = useState<'discoverable' | 'discreet'>('discoverable')
  const [teaserOptIn, setTeaserOptIn] = useState(false)

  function goStep(n: Step) {
    setStep(n)
  }

  function addInterest() {
    const v = interestInput.trim()
    if (v && interests.length < 6 && !interests.includes(v)) {
      setInterests((prev) => [...prev, v])
      setInterestInput('')
    }
  }

  function handleInterestKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addInterest()
    }
  }

  function triggerUpload(slot: number | 'selfie') {
    activeSlotRef.current = slot
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0]
    const slot = activeSlotRef.current
    e.target.value = ''
    if (!original || slot === null) return

    setPhotoError(null)
    // Shrink first: a phone photo of 2-5 MB becomes a few hundred KB.
    const file = await compressImage(original)

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setPhotoError('Photos must be JPG, PNG or WebP images.')
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError('That photo is too large. Try a smaller one.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const previewUrl = reader.result as string
      if (slot === 'selfie') {
        setSelfie(file)
        setSelfiePreview(previewUrl)
      } else {
        setPhotos((prev) => {
          const next = [...prev]
          next[slot] = file
          return next
        })
        setPhotoPreviews((prev) => {
          const next = [...prev]
          next[slot] = previewUrl
          return next
        })
      }
    }
    reader.readAsDataURL(file)
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      const next = [...prev]
      next[index] = null
      return next
    })
    setPhotoPreviews((prev) => {
      const next = [...prev]
      next[index] = null
      return next
    })
  }

  function calculatedAge(): number | null {
    if (!dob) return null
    const birth = new Date(dob)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const hadBirthday =
      today.getMonth() > birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate())
    if (!hadBirthday) age -= 1
    return age
  }

  async function handleSubmit() {
    setSubmitError(null)

    const files = [...photos, selfie].filter((f): f is File => !!f)
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0)
    if (totalBytes > MAX_TOTAL_BYTES) {
      setSubmitError('Your photos are too large together. Remove one or two and try again.')
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.set('displayName', name)
      formData.set('dob', dob)
      formData.set('campus', campus)
      formData.set('phone', phone)
      formData.set('lookingFor', lookingFor ?? '')
      formData.set('showMe', showMe ?? '')
      formData.set('bio', bio)
      interests.forEach((tag) => formData.append('interests', tag))
      photos.forEach((photo) => {
        if (photo) formData.append('photos', photo)
      })
      if (selfie) formData.set('selfie', selfie)
      formData.set('visibility', visibility)
      formData.set('teaserOptIn', visibility === 'discoverable' && teaserOptIn ? '1' : '0')

      const result = await createProfile(formData)
      if (result?.error) {
        setSubmitError(result.error)
        return
      }
      goStep(5)
    } catch {
      // A rejected request (network drop, payload too large, server error)
      // used to leave the button stuck on "Submitting...".
      setSubmitError("We couldn't upload your profile. Check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const photoCount = photos.filter(Boolean).length
  const age = calculatedAge()

  return (
    <main className={styles.main}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className={styles.hiddenFileInput}
        onChange={handleFileChange}
      />

      <div className={styles.progressTrack}>
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className={`${styles.progressSeg} ${step >= n ? styles.done : ''}`} />
        ))}
      </div>

      {step === 1 && (
        <>
          <div className={styles.stepLabel}>Step 1 of 4</div>
          <h1>The basics</h1>
          <p className={styles.subtitle}>This shows up on your profile card.</p>

          <div className={styles.field}>
            <label>Display name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amara K." maxLength={60} />
          </div>

          <div className={styles.field}>
            <label>Date of birth</label>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>

          <div className={styles.field}>
            <label>Campus</label>
            <select value={campus} onChange={(e) => setCampus(e.target.value)}>
              <option value="">Select your campus</option>
              {CAMPUS_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label>WhatsApp number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07XXXXXXXX"
            />
            <div className={styles.hint}>This is how matches will reach you — it's only shared once you're both connected.</div>
          </div>

          <div className={styles.field}>
            <label>Looking for</label>
            <div className={styles.chipGroup}>
              {LOOKING_FOR_OPTIONS.map((opt) => (
                <div
                  key={opt}
                  className={`${styles.chipOption} ${lookingFor === opt ? styles.selected : ''}`}
                  onClick={() => setLookingFor(opt)}
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
                  onClick={() => setShowMe(opt)}
                >
                  {opt}
                </div>
              ))}
            </div>
          </div>

          <button
            className={styles.primaryBtn}
            onClick={() => goStep(2)}
            disabled={!name || !dob || !campus || !normalizeUgandaPhone(phone)}
          >
            Continue
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <div className={styles.backLink} onClick={() => goStep(1)}>
            <BackIcon /> Back
          </div>
          <div className={styles.stepLabel}>Step 2 of 4</div>
          <h1>About you</h1>
          <p className={styles.subtitle}>Keep it short — you can always update this later.</p>

          <div className={styles.field}>
            <label>Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 220))} placeholder="A line or two about you..." />
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
                maxLength={40}
              />
              <button className={styles.addInterestBtn} onClick={addInterest} type="button">
                +
              </button>
            </div>
            <div className={styles.interestChips}>
              {interests.map((tag, i) => (
                <span key={tag} className={styles.interestChip}>
                  {tag}
                  <button onClick={() => setInterests((prev) => prev.filter((_, idx) => idx !== i))} type="button">
                    <RemoveIcon />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <button className={styles.primaryBtn} onClick={() => goStep(3)}>
            Continue
          </button>
        </>
      )}

      {step === 3 && (
        <>
          <div className={styles.backLink} onClick={() => goStep(2)}>
            <BackIcon /> Back
          </div>
          <div className={styles.stepLabel}>Step 3 of 4</div>
          <h1>Add your photos</h1>
          <p className={styles.subtitle}>1–6 photos. Every photo is reviewed before it's shown on Discover.</p>

          <div className={styles.photoGrid}>
            {photoPreviews.map((src, i) => (
              <div key={i} className={styles.photoSlot} onClick={() => !src && triggerUpload(i)}>
                {src ? (
                  <>
                    <img src={src} alt="" />
                    {i === 0 && <span className={styles.primaryTag}>Main</span>}
                    <button
                      className={styles.removeBtn}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removePhoto(i)
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
          <p className={styles.photoHint}>
            Your first photo is your main photo. Clear, recent photos of just you get approved faster.
          </p>
          {photoError && <p className={styles.fieldError}>{photoError}</p>}

          <div className={styles.selfieRow}>
            <div className={styles.selfieSlot} onClick={() => triggerUpload('selfie')}>
              {selfiePreview ? <img src={selfiePreview} alt="" /> : <SelfieIcon />}
            </div>
            <div>
              <div className={styles.selfieTextTitle}>Verification selfie (optional)</div>
              <div className={styles.selfieTextSub}>Not shown publicly — helps us confirm your photos are really you.</div>
            </div>
          </div>

          <button className={styles.primaryBtn} onClick={() => goStep(4)} disabled={photoCount === 0}>
            Continue
          </button>
        </>
      )}

      {step === 4 && (
        <>
          <div className={styles.backLink} onClick={() => goStep(3)}>
            <BackIcon /> Back
          </div>
          <div className={styles.stepLabel}>Step 4 of 4</div>
          <h1>Review your profile</h1>
          <p className={styles.subtitle}>Double-check before we send this for review.</p>

          <div className={styles.reviewCard}>
            <div className={styles.reviewRow}>
              <span className={styles.label}>Name</span>
              <span className={styles.value}>{name || '—'}</span>
            </div>
            <div className={styles.reviewRow}>
              <span className={styles.label}>Age</span>
              <span className={styles.value}>{age ?? '—'}</span>
            </div>
            <div className={styles.reviewRow}>
              <span className={styles.label}>Campus</span>
              <span className={styles.value}>{campus || '—'}</span>
            </div>
            <div className={styles.reviewRow}>
              <span className={styles.label}>Looking for</span>
              <span className={styles.value}>{lookingFor ?? '—'}</span>
            </div>
            <div className={styles.reviewRow}>
              <span className={styles.label}>Show me</span>
              <span className={styles.value}>{showMe ?? '—'}</span>
            </div>
            <div className={styles.reviewRow}>
              <span className={styles.label}>Bio</span>
              <span className={styles.value}>{bio || '—'}</span>
            </div>
            <div className={styles.reviewRow}>
              <span className={styles.label}>Interests</span>
              <span className={styles.value}>{interests.join(', ') || '—'}</span>
            </div>
            <div className={styles.reviewRow}>
              <span className={styles.label}>Photos</span>
              <span className={styles.value}>{photoCount} added</span>
            </div>
            <div className={styles.reviewRow}>
              <span className={styles.label}>Visibility</span>
              <span className={styles.value}>{visibility === 'discreet' ? 'Discreet' : 'Listed on Discover'}</span>
            </div>
          </div>

          <div className={styles.visibilityHeading}>Who can find you?</div>
          <div className={styles.visibilityGroup} role="radiogroup" aria-label="Profile visibility">
            <button
              type="button"
              role="radio"
              aria-checked={visibility === 'discoverable'}
              className={`${styles.visibilityOption} ${visibility === 'discoverable' ? styles.selected : ''}`}
              onClick={() => setVisibility('discoverable')}
            >
              <div className={styles.visibilityTitle}>Listed on Discover</div>
              <div className={styles.visibilitySub}>Other members can find your profile in the Discover feed.</div>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={visibility === 'discreet'}
              className={`${styles.visibilityOption} ${visibility === 'discreet' ? styles.selected : ''}`}
              onClick={() => {
                setVisibility('discreet')
                setTeaserOptIn(false)
              }}
            >
              <div className={styles.visibilityTitle}>Discreet</div>
              <div className={styles.visibilitySub}>
                You won't appear on Discover. You can still browse everyone else's profile.
              </div>
            </button>
          </div>
          {visibility === 'discoverable' && (
            <label className={styles.teaserCheck}>
              <input type="checkbox" checked={teaserOptIn} onChange={(e) => setTeaserOptIn(e.target.checked)} />
              <span>
                Optional: also show my main photo, first name, age and campus on Silk Road's public homepage. Anyone
                can see it, even without an account.
              </span>
            </label>
          )}
          <p className={styles.visibilityHint}>You can change this any time in Edit Profile.</p>

          {submitError && <p className={styles.fieldError}>{submitError}</p>}

          <button className={styles.primaryBtn} onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit for review'}
          </button>
        </>
      )}

      {step === 5 && (
        <div className={styles.successWrap}>
          <div className={styles.successBadge}>
            <CheckIcon />
          </div>
          <h1>You're all set</h1>
          <p className={styles.subtitle}>Your profile is under review. This usually takes a few hours.</p>

          <div className={styles.pendingList}>
            <div className={styles.pendingItem}>
              <span className={styles.pendingDot}>
                <DotIcon />
              </span>
              We'll email you once your profile is approved
            </div>
            <div className={styles.pendingItem}>
              <span className={styles.pendingDot}>
                <DotIcon />
              </span>
              {visibility === 'discreet'
                ? 'Your profile stays hidden from Discover, as you chose'
                : "You won't appear on Discover until then"}
            </div>
            <div className={styles.pendingItem}>
              <span className={styles.pendingDot}>
                <DotIcon />
              </span>
              You can still browse other profiles in the meantime
            </div>
          </div>

          <button className={styles.primaryBtn} onClick={() => router.push('/discover')}>
            Browse Discover
          </button>
        </div>
      )}
    </main>
  )
}
