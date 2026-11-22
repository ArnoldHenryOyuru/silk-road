'use client'

import { useState, useRef, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, ChevronDown, ChevronUp, Plus, ShieldCheck, User, X } from 'lucide-react'
import {
  saveChecklistAbout,
  saveChecklistBasics,
  saveChecklistPhotos,
  saveChecklistVisibility,
  submitProfileForReview,
} from './actions'
import { normalizeUgandaPhone } from '@/lib/phone'
import { compressImage } from '@/lib/compress-image'
import EmailVerifyModal from '@/components/EmailVerifyModal'
import styles from './onboarding.module.css'

const CAMPUS_OPTIONS = ['Makerere University', 'MUBS', 'Kyambogo University', 'Other']
const LOOKING_FOR_OPTIONS = ['Friends', 'Dating', 'Something casual']
const SHOW_ME_OPTIONS = ['Men', 'Women', 'Everyone']

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_PHOTO_BYTES = 3 * 1024 * 1024
const MAX_TOTAL_BYTES = 4.2 * 1024 * 1024

export interface ChecklistPhoto {
  id: string
  url: string
  isPrimary: boolean
}

export interface ProfileChecklistInitial {
  email: string
  emailVerified: boolean
  status: 'draft' | 'rejected'
  rejectionReason: string | null
  daysLeftInFixWindow: number
  displayName: string
  dob: string
  campus: string
  phone: string
  lookingFor: string | null
  showMe: string | null
  bio: string
  interests: string[]
  isDiscoverable: boolean
  teaserOptIn: boolean
  photos: ChecklistPhoto[]
  selfieUrl: string | null
}

type PhotoSlot =
  | { kind: 'existing'; id: string; url: string; isPrimary: boolean }
  | { kind: 'new'; file: File; previewUrl: string }
  | null

type SectionKey = 'basics' | 'about' | 'photos' | 'visibility' | 'email'

export default function ProfileChecklist({ initial }: { initial: ProfileChecklistInitial }) {
  const router = useRouter()

  const [openSection, setOpenSection] = useState<SectionKey>('basics')

  // Section 1: Basics
  const [name, setName] = useState(initial.displayName)
  const [dob, setDob] = useState(initial.dob)
  const [campus, setCampus] = useState(initial.campus)
  const [phone, setPhone] = useState(initial.phone)
  const [lookingFor, setLookingFor] = useState<string | null>(initial.lookingFor)
  const [showMe, setShowMe] = useState<string | null>(initial.showMe)
  const [basicsSaved, setBasicsSaved] = useState(
    Boolean(initial.displayName && initial.dob && initial.campus && normalizeUgandaPhone(initial.phone))
  )
  const [basicsSaving, setBasicsSaving] = useState(false)
  const [basicsError, setBasicsError] = useState<string | null>(null)

  // Section 2: About
  const [bio, setBio] = useState(initial.bio)
  const [interests, setInterests] = useState<string[]>(initial.interests)
  const [interestInput, setInterestInput] = useState('')
  const [aboutSaved, setAboutSaved] = useState(Boolean(initial.bio || initial.interests.length > 0))
  const [aboutSaving, setAboutSaving] = useState(false)
  const [aboutError, setAboutError] = useState<string | null>(null)

  // Section 3: Photos + selfie
  const initialSlots: PhotoSlot[] = initial.photos
    .slice()
    .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
    .map((p) => ({ kind: 'existing', id: p.id, url: p.url, isPrimary: p.isPrimary }))
  while (initialSlots.length < 6) initialSlots.push(null)

  const [slots, setSlots] = useState<PhotoSlot[]>(initialSlots)
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(initial.selfieUrl)
  const [photosSaved, setPhotosSaved] = useState(initial.photos.length > 0)
  const [photosSaving, setPhotosSaving] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeSlotRef = useRef<number | 'selfie' | null>(null)

  // Section 4: Visibility
  const [visibility, setVisibility] = useState<'discoverable' | 'discreet'>(
    initial.isDiscoverable ? 'discoverable' : 'discreet'
  )
  const [teaserOptIn, setTeaserOptIn] = useState(initial.isDiscoverable && initial.teaserOptIn)
  const [visibilitySaving, setVisibilitySaving] = useState(false)
  const [visibilityNote, setVisibilityNote] = useState<string | null>(null)

  // Section 5: Email verification
  const [emailVerified, setEmailVerified] = useState(initial.emailVerified)
  const [otpOpen, setOtpOpen] = useState(false)

  // Submit for review
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const requiredComplete = [basicsSaved, photosSaved, emailVerified].filter(Boolean).length
  const totalSteps = 5
  const completedSteps = [basicsSaved, aboutSaved, photosSaved, true, emailVerified].filter(Boolean).length

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
        setSelfieFile(file)
        setSelfiePreview(previewUrl)
      } else {
        setSlots((prev) => {
          const next = [...prev]
          next[slot] = { kind: 'new', file, previewUrl }
          return next
        })
        setPhotosSaved(false)
      }
    }
    reader.readAsDataURL(file)
  }

  function removePhoto(index: number) {
    setSlots((prev) => {
      const current = prev[index]
      if (current?.kind === 'existing') {
        setRemovedIds((ids) => [...ids, current.id])
      }
      const next = [...prev]
      next[index] = null
      return next
    })
    setPhotosSaved(false)
  }

  async function handleSaveBasics() {
    setBasicsError(null)
    if (!name.trim() || !dob || !campus || !normalizeUgandaPhone(phone)) {
      setBasicsError('Enter your name, 18+ date of birth, campus, and WhatsApp number.')
      return
    }
    setBasicsSaving(true)
    const fd = new FormData()
    fd.set('displayName', name.trim())
    fd.set('dob', dob)
    fd.set('campus', campus)
    fd.set('phone', phone.trim())
    fd.set('lookingFor', lookingFor ?? '')
    fd.set('showMe', showMe ?? '')

    const res = await saveChecklistBasics(fd)
    setBasicsSaving(false)
    if ('error' in res && res.error) {
      setBasicsError(res.error)
      return
    }
    setBasicsSaved(true)
    setOpenSection('about')
  }

  async function handleSaveAbout() {
    setAboutError(null)
    setAboutSaving(true)
    const fd = new FormData()
    fd.set('bio', bio.trim())
    interests.forEach((tag) => fd.append('interests', tag))

    const res = await saveChecklistAbout(fd)
    setAboutSaving(false)
    if ('error' in res && res.error) {
      setAboutError(res.error)
      return
    }
    setAboutSaved(true)
    setOpenSection('photos')
  }

  async function handleSavePhotos() {
    setPhotoError(null)
    const activeSlots = slots.filter((s): s is Exclude<PhotoSlot, null> => s !== null)
    if (activeSlots.length === 0) {
      setPhotoError('Add at least one photo before saving.')
      return
    }

    const newFiles = activeSlots.filter((s): s is Extract<PhotoSlot, { kind: 'new' }> => s.kind === 'new').map((s) => s.file)
    const uploadFiles = selfieFile ? [...newFiles, selfieFile] : newFiles
    const totalBytes = uploadFiles.reduce((sum, f) => sum + f.size, 0)
    if (totalBytes > MAX_TOTAL_BYTES) {
      setPhotoError('Your new photos are too large together. Remove one or two and try again.')
      return
    }

    setPhotosSaving(true)
    const fd = new FormData()
    removedIds.forEach((id) => fd.append('removedPhotoIds', id))
    slots.forEach((slot, i) => {
      if (!slot) return
      if (slot.kind === 'existing') {
        fd.append('slotOrder', `existing:${slot.id}`)
      } else {
        fd.append('slotOrder', `new:${i}`)
        fd.append(`newPhoto:${i}`, slot.file)
      }
    })
    if (selfieFile) fd.set('selfie', selfieFile)

    const res = await saveChecklistPhotos(fd)
    setPhotosSaving(false)
    if ('error' in res && res.error) {
      setPhotoError(res.error)
      return
    }
    if ('photos' in res && res.photos) {
      const synced: PhotoSlot[] = res.photos
        .slice()
        .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
        .map((p) => ({ kind: 'existing', id: p.id, url: p.url, isPrimary: p.isPrimary }))
      while (synced.length < 6) synced.push(null)
      setSlots(synced)
      setRemovedIds([])
      setSelfieFile(null)
      setPhotosSaved(res.photos.length > 0)
    } else {
      setPhotosSaved(true)
    }
    setOpenSection(emailVerified ? 'visibility' : 'email')
  }

  async function handleSaveVisibility(nextVis: 'discoverable' | 'discreet', nextTeaser: boolean) {
    setVisibility(nextVis)
    setTeaserOptIn(nextTeaser)
    setVisibilityNote(null)
    setVisibilitySaving(true)
    const fd = new FormData()
    fd.set('visibility', nextVis)
    fd.set('teaserOptIn', nextVis === 'discoverable' && nextTeaser ? '1' : '0')
    await saveChecklistVisibility(fd)
    setVisibilitySaving(false)
    setVisibilityNote(nextVis === 'discreet' ? 'Saved as Discreet.' : 'Saved as Listed on Discover.')
  }

  async function handleSubmitForReview() {
    setSubmitError(null)
    if (!basicsSaved) {
      setSubmitError('Save The basics first before submitting.')
      setOpenSection('basics')
      return
    }
    if (!photosSaved) {
      setSubmitError('Save at least one photo before submitting.')
      setOpenSection('photos')
      return
    }
    if (!emailVerified) {
      setOtpOpen(true)
      return
    }

    setSubmitting(true)
    const res = await submitProfileForReview()
    setSubmitting(false)
    if ('error' in res && res.error) {
      if ('needsEmailVerification' in res && res.needsEmailVerification) {
        setOtpOpen(true)
      }
      setSubmitError(res.error)
      return
    }
    router.push('/pending-review')
    router.refresh()
  }

  const photoCount = slots.filter(Boolean).length

  return (
    <main className={styles.main}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className={styles.hiddenFileInput}
        onChange={handleFileChange}
      />

      {initial.status === 'rejected' && (
        <div className={styles.rejectBanner}>
          <div className={styles.rejectBannerTitle}>Profile needs updates before it can go live</div>
          <div>
            {initial.rejectionReason || 'Please review your details and photos, then resubmit.'}
            {' '}
            You have <strong>{initial.daysLeftInFixWindow} day{initial.daysLeftInFixWindow === 1 ? '' : 's'}</strong> left
            in your 14-day window to fix &amp; resubmit (or request a refund from your status page).
          </div>
        </div>
      )}

      <div className={styles.checklistHeader}>
        <div className={styles.stepLabel}>Profile checklist</div>
        <div className={styles.progressCount}>
          {completedSteps} of {totalSteps} ready
        </div>
      </div>

      <div className={styles.progressTrack}>
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className={`${styles.progressSeg} ${completedSteps >= n ? styles.done : ''}`} />
        ))}
      </div>

      <h1>Complete your profile</h1>
      <p className={styles.subtitle}>
        Finish these items at your own pace. You can already browse Discover while you set up.
      </p>

      <div className={styles.checklistStack}>
        {/* 1. Basics */}
        <section className={styles.checkItem}>
          <button
            type="button"
            className={styles.checkItemHeader}
            onClick={() => setOpenSection(openSection === 'basics' ? 'about' : 'basics')}
          >
            <div className={styles.checkItemLeft}>
              <span className={`${styles.checkCircle} ${basicsSaved ? styles.done : ''}`}>
                {basicsSaved ? <Check size={14} /> : '1'}
              </span>
              <div>
                <div className={styles.checkItemTitle}>The basics</div>
                <div className={styles.checkItemMeta}>
                  {basicsSaved ? `${name} · ${campus}` : 'Name, 18+ age, campus & WhatsApp'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`${styles.checkTag} ${basicsSaved ? styles.done : ''}`}>
                {basicsSaved ? 'Done' : 'Required'}
              </span>
              {openSection === 'basics' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>

          {openSection === 'basics' && (
            <div className={styles.checkItemBody}>
              <div className={styles.field}>
                <label>Display name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setBasicsSaved(false)
                  }}
                  placeholder="e.g. Amara K."
                  maxLength={60}
                />
              </div>

              <div className={styles.field}>
                <label>Date of birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => {
                    setDob(e.target.value)
                    setBasicsSaved(false)
                  }}
                />
              </div>

              <div className={styles.field}>
                <label>Campus</label>
                <select
                  value={campus}
                  onChange={(e) => {
                    setCampus(e.target.value)
                    setBasicsSaved(false)
                  }}
                >
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
                  onChange={(e) => {
                    setPhone(e.target.value)
                    setBasicsSaved(false)
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
                        setBasicsSaved(false)
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
                        setBasicsSaved(false)
                      }}
                    >
                      {opt}
                    </div>
                  ))}
                </div>
              </div>

              {basicsError && <p className={styles.fieldError}>{basicsError}</p>}

              <button
                type="button"
                className={styles.sectionSaveBtn}
                onClick={handleSaveBasics}
                disabled={basicsSaving}
              >
                {basicsSaving ? 'Saving…' : 'Save basics'}
              </button>
            </div>
          )}
        </section>

        {/* 2. About you */}
        <section className={styles.checkItem}>
          <button
            type="button"
            className={styles.checkItemHeader}
            onClick={() => setOpenSection(openSection === 'about' ? 'photos' : 'about')}
          >
            <div className={styles.checkItemLeft}>
              <span className={`${styles.checkCircle} ${aboutSaved ? styles.done : ''}`}>
                {aboutSaved ? <Check size={14} /> : '2'}
              </span>
              <div>
                <div className={styles.checkItemTitle}>About you</div>
                <div className={styles.checkItemMeta}>
                  {aboutSaved ? 'Bio & interests saved' : 'Add a short bio and up to 6 interests'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`${styles.checkTag} ${aboutSaved ? styles.done : ''}`}>
                {aboutSaved ? 'Done' : 'Optional'}
              </span>
              {openSection === 'about' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>

          {openSection === 'about' && (
            <div className={styles.checkItemBody}>
              <div className={styles.field}>
                <label>Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 220))}
                  placeholder="A line or two about you..."
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
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {aboutError && <p className={styles.fieldError}>{aboutError}</p>}

              <button
                type="button"
                className={styles.sectionSaveBtn}
                onClick={handleSaveAbout}
                disabled={aboutSaving}
              >
                {aboutSaving ? 'Saving…' : 'Save about you'}
              </button>
            </div>
          )}
        </section>

        {/* 3. Photos */}
        <section className={styles.checkItem}>
          <button
            type="button"
            className={styles.checkItemHeader}
            onClick={() => setOpenSection(openSection === 'photos' ? 'visibility' : 'photos')}
          >
            <div className={styles.checkItemLeft}>
              <span className={`${styles.checkCircle} ${photosSaved ? styles.done : ''}`}>
                {photosSaved ? <Check size={14} /> : '3'}
              </span>
              <div>
                <div className={styles.checkItemTitle}>Photos &amp; verification selfie</div>
                <div className={styles.checkItemMeta}>
                  {photoCount > 0 ? `${photoCount} photo${photoCount === 1 ? '' : 's'} added` : 'Add 1–6 photos'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`${styles.checkTag} ${photosSaved ? styles.done : ''}`}>
                {photosSaved ? 'Done' : 'Required'}
              </span>
              {openSection === 'photos' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>

          {openSection === 'photos' && (
            <div className={styles.checkItemBody}>
              <div className={styles.photoGrid}>
                {slots.map((slot, i) => (
                  <div key={i} className={styles.photoSlot} onClick={() => !slot && triggerUpload(i)}>
                    {slot ? (
                      <>
                        <img src={slot.kind === 'existing' ? slot.url : slot.previewUrl} alt="" />
                        {i === 0 && <span className={styles.primaryTag}>Main</span>}
                        <button
                          className={styles.removeBtn}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            removePhoto(i)
                          }}
                        >
                          <X size={11} />
                        </button>
                      </>
                    ) : (
                      <Plus className={styles.plusIcon} size={22} />
                    )}
                  </div>
                ))}
              </div>
              <p className={styles.photoHint}>
                Your first photo is your main photo. Clear, recent photos of just you get approved faster.
              </p>

              <div className={styles.selfieRow}>
                <div className={styles.selfieSlot} onClick={() => triggerUpload('selfie')}>
                  {selfiePreview ? <img src={selfiePreview} alt="" /> : <User size={18} />}
                </div>
                <div>
                  <div className={styles.selfieTextTitle}>Verification selfie (optional)</div>
                  <div className={styles.selfieTextSub}>
                    Not shown publicly — helps us confirm your photos are really you.
                  </div>
                </div>
              </div>

              {photoError && <p className={styles.fieldError}>{photoError}</p>}

              <button
                type="button"
                className={styles.sectionSaveBtn}
                onClick={handleSavePhotos}
                disabled={photosSaving || photoCount === 0}
              >
                {photosSaving ? 'Uploading…' : 'Save photos'}
              </button>
            </div>
          )}
        </section>

        {/* 4. Visibility (Discreet vs Listed) */}
        <section className={styles.checkItem}>
          <button
            type="button"
            className={styles.checkItemHeader}
            onClick={() => setOpenSection(openSection === 'visibility' ? 'email' : 'visibility')}
          >
            <div className={styles.checkItemLeft}>
              <span className={`${styles.checkCircle} ${styles.done}`}>
                <Check size={14} />
              </span>
              <div>
                <div className={styles.checkItemTitle}>Privacy &amp; visibility</div>
                <div className={styles.checkItemMeta}>
                  {visibility === 'discreet' ? 'Discreet (hidden from Discover)' : 'Listed on Discover'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`${styles.checkTag} ${styles.done}`}>Set</span>
              {openSection === 'visibility' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>

          {openSection === 'visibility' && (
            <div className={styles.checkItemBody}>
              <div className={styles.visibilityGroup} role="radiogroup" aria-label="Profile visibility">
                <button
                  type="button"
                  role="radio"
                  aria-checked={visibility === 'discoverable'}
                  disabled={visibilitySaving}
                  className={`${styles.visibilityOption} ${visibility === 'discoverable' ? styles.selected : ''}`}
                  onClick={() => handleSaveVisibility('discoverable', teaserOptIn)}
                >
                  <div className={styles.visibilityTitle}>Listed on Discover</div>
                  <div className={styles.visibilitySub}>
                    Other members can find your profile in the Discover feed once approved.
                  </div>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={visibility === 'discreet'}
                  disabled={visibilitySaving}
                  className={`${styles.visibilityOption} ${visibility === 'discreet' ? styles.selected : ''}`}
                  onClick={() => handleSaveVisibility('discreet', false)}
                >
                  <div className={styles.visibilityTitle}>Discreet</div>
                  <div className={styles.visibilitySub}>
                    You won&apos;t appear on Discover. You can still browse everyone else&apos;s profile.
                  </div>
                </button>
              </div>
              {visibility === 'discoverable' && (
                <label className={styles.teaserCheck}>
                  <input
                    type="checkbox"
                    checked={teaserOptIn}
                    disabled={visibilitySaving}
                    onChange={(e) => handleSaveVisibility('discoverable', e.target.checked)}
                  />
                  <span>
                    Optional: also show my main photo, first name, age and campus on Silk Road&apos;s public homepage.
                  </span>
                </label>
              )}
              {visibilityNote && <p className={styles.visibilityHint}>{visibilityNote}</p>}
            </div>
          )}
        </section>

        {/* 5. Verify Email (OTP at submit time) */}
        <section className={styles.checkItem}>
          <button
            type="button"
            className={styles.checkItemHeader}
            onClick={() => setOpenSection('email')}
          >
            <div className={styles.checkItemLeft}>
              <span className={`${styles.checkCircle} ${emailVerified ? styles.done : ''}`}>
                {emailVerified ? <Check size={14} /> : <ShieldCheck size={14} />}
              </span>
              <div>
                <div className={styles.checkItemTitle}>Verify your email</div>
                <div className={styles.checkItemMeta}>
                  {emailVerified ? `${initial.email} verified` : `Send a 6-digit code to ${initial.email}`}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`${styles.checkTag} ${emailVerified ? styles.done : ''}`}>
                {emailVerified ? 'Verified' : 'Required'}
              </span>
              {openSection === 'email' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>

          {openSection === 'email' && (
            <div className={styles.checkItemBody}>
              {emailVerified ? (
                <p className={styles.hint}>Your email ({initial.email}) is verified.</p>
              ) : (
                <>
                  <p className={styles.hint}>
                    Verify your email with a 6-digit code before submitting your profile or subscribing.
                  </p>
                  <button
                    type="button"
                    className={styles.sectionSaveBtn}
                    onClick={() => setOtpOpen(true)}
                  >
                    Send 6-digit verification code
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      </div>

      {submitError && <p className={styles.fieldError}>{submitError}</p>}

      <button
        type="button"
        className={styles.primaryBtn}
        onClick={handleSubmitForReview}
        disabled={submitting}
      >
        {submitting
          ? 'Submitting…'
          : requiredComplete < 3
            ? `Complete required items (${requiredComplete}/3)`
            : initial.status === 'rejected'
              ? 'Resubmit for review'
              : 'Submit for review'}
      </button>

      <div className={styles.browseNote}>
        Want to look around first? <Link href="/discover">Browse Discover</Link>
      </div>

      <EmailVerifyModal
        open={otpOpen}
        email={initial.email}
        onClose={() => setOtpOpen(false)}
        onVerified={() => {
          setEmailVerified(true)
          setOtpOpen(false)
          setSubmitError(null)
        }}
      />
    </main>
  )
}
