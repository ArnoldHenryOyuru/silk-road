'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeUgandaPhone } from '@/lib/phone'
import {
  FIX_WINDOW_DAYS,
  isPhoneBlocklisted,
  resumePausedSubscriptionsForUser,
} from '@/lib/member-stage'

const PHOTO_BUCKET = 'profile-photos'
const MAX_PHOTOS = 6
const MAX_FILE_BYTES = 3 * 1024 * 1024
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function calculateAge(dob: string): number {
  const birthDate = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const hadBirthdayThisYear =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate())
  if (!hadBirthdayThisYear) age -= 1
  return age
}

function checkImage(file: File): string | null {
  if (!EXTENSIONS[file.type]) return 'Photos must be JPG, PNG or WebP images.'
  if (file.size > MAX_FILE_BYTES) return 'One of your photos is too large. Try a smaller one.'
  return null
}

async function getEditableProfile(userId: string) {
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('profiles')
    .select('id, status, display_name, age, campus, rejected_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (!existing) {
    return { admin, profile: null }
  }
  return {
    admin,
    profile: existing as {
      id: string
      status: string
      display_name: string | null
      age: number | null
      campus: string | null
      rejected_at?: string | null
    },
  }
}

export async function saveChecklistBasics(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const displayName = String(formData.get('displayName') || '').trim()
  const dob = String(formData.get('dob') || '').trim()
  const campus = String(formData.get('campus') || '').trim()
  const phone = String(formData.get('phone') || '').trim()
  const lookingFor = String(formData.get('lookingFor') || '').trim()
  const showMe = String(formData.get('showMe') || '').trim()

  if (displayName.length < 2 || displayName.length > 60) {
    return { error: 'Enter your name (2 to 60 characters).' }
  }
  if (!campus || campus.length > 80) {
    return { error: 'Select your campus.' }
  }
  if (!dob) {
    return { error: 'Date of birth is required.' }
  }
  const age = calculateAge(dob)
  if (!Number.isFinite(age) || age < 18 || age > 100) {
    return { error: 'You must be 18 or older to use Silk Road.' }
  }

  const normalizedPhone = normalizeUgandaPhone(phone)
  if (!normalizedPhone) {
    return { error: 'Enter a valid Ugandan mobile number (e.g. 07XXXXXXXX).' }
  }

  const { admin, profile } = await getEditableProfile(user.id)
  if (profile && profile.status !== 'draft' && profile.status !== 'rejected') {
    return { error: 'Use Edit Profile to update an approved or submitted profile.' }
  }

  if (await isPhoneBlocklisted(admin, normalizedPhone)) {
    return { error: 'This WhatsApp number cannot be used on Silk Road.' }
  }

  const { error: phoneError } = await admin
    .from('users')
    .update({ phone_number: normalizedPhone })
    .eq('id', user.id)

  if (phoneError) {
    if (phoneError.code === '23505') {
      return { error: 'That WhatsApp number is already linked to another account.' }
    }
    return { error: 'Could not save your WhatsApp number.' }
  }

  if (profile) {
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        display_name: displayName,
        age,
        campus,
        looking_for: lookingFor || null,
        show_me: showMe || null,
      })
      .eq('id', profile.id)
    if (updateError) return { error: 'Could not save basics.' }
  } else {
    const { error: insertError } = await admin.from('profiles').insert({
      user_id: user.id,
      display_name: displayName,
      age,
      campus,
      looking_for: lookingFor || null,
      show_me: showMe || null,
      status: 'draft',
      interests: [],
      is_discoverable: true,
      teaser_opt_in: false,
    })
    if (insertError) return { error: 'Could not create profile draft.' }
  }

  revalidatePath('/onboarding/profile')
  revalidatePath('/discover')
  return { success: true as const }
}

export async function saveChecklistAbout(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const bio = String(formData.get('bio') || '').trim()
  const interests = formData.getAll('interests').map(String).map((t) => t.trim()).filter(Boolean).slice(0, 6)

  if (bio.length > 1000) return { error: 'Bio is too long.' }
  if (interests.some((i) => i.length > 40)) return { error: 'An interest tag is too long.' }

  const { admin, profile } = await getEditableProfile(user.id)
  if (!profile) return { error: 'Save the basics first.' }
  if (profile.status !== 'draft' && profile.status !== 'rejected') {
    return { error: 'Use Edit Profile to update an approved or submitted profile.' }
  }

  const { error } = await admin
    .from('profiles')
    .update({ bio: bio || null, interests })
    .eq('id', profile.id)

  if (error) return { error: 'Could not save your bio and interests.' }

  revalidatePath('/onboarding/profile')
  return { success: true as const }
}

export async function saveChecklistVisibility(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const isDiscoverable = String(formData.get('visibility') || 'discoverable') !== 'discreet'
  const teaserOptIn = isDiscoverable && formData.get('teaserOptIn') === '1'

  const { admin, profile } = await getEditableProfile(user.id)
  if (!profile) return { error: 'Save the basics first.' }

  const { error } = await admin
    .from('profiles')
    .update({ is_discoverable: isDiscoverable, teaser_opt_in: teaserOptIn })
    .eq('id', profile.id)

  if (error) return { error: 'Could not save visibility settings.' }

  revalidatePath('/onboarding/profile')
  return { success: true as const }
}

export async function saveChecklistPhotos(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { admin, profile } = await getEditableProfile(user.id)
  if (!profile) return { error: 'Save the basics first.' }
  if (profile.status !== 'draft' && profile.status !== 'rejected') {
    return { error: 'Use Edit Profile to update photos.' }
  }

  const removedIds = formData.getAll('removedPhotoIds').map(String).filter(Boolean)
  const slotOrder = formData.getAll('slotOrder').map(String).filter(Boolean)
  const selfieEntry = formData.get('selfie')
  const selfie = selfieEntry instanceof File && selfieEntry.size > 0 ? selfieEntry : null

  const newFiles: File[] = []
  for (const slot of slotOrder) {
    if (slot.startsWith('new:')) {
      const idx = slot.slice(4)
      const f = formData.get(`newPhoto:${idx}`)
      if (f instanceof File && f.size > 0) newFiles.push(f)
    }
  }

  if (newFiles.length > MAX_PHOTOS) {
    return { error: `You can add up to ${MAX_PHOTOS} photos.` }
  }

  for (const f of selfie ? [...newFiles, selfie] : newFiles) {
    const problem = checkImage(f)
    if (problem) return { error: problem }
  }

  for (const photoId of removedIds) {
    const { data: row } = await admin
      .from('profile_photos')
      .select('id, image_url, profile_id')
      .eq('id', photoId)
      .maybeSingle()
    if (row && row.profile_id === profile.id) {
      await admin.from('profile_photos').delete().eq('id', photoId)
      await admin.storage.from(PHOTO_BUCKET).remove([row.image_url])
    }
  }

  let primaryAssigned = false
  for (const slot of slotOrder) {
    const [kind, ref] = slot.split(':')
    if (kind === 'existing' && ref) {
      await admin
        .from('profile_photos')
        .update({ is_primary: !primaryAssigned })
        .eq('id', ref)
        .eq('profile_id', profile.id)
      primaryAssigned = true
    } else if (kind === 'new' && ref) {
      const file = formData.get(`newPhoto:${ref}`)
      if (!(file instanceof File) || file.size === 0) continue
      const path = `${user.id}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`
      const { error: uploadError } = await admin.storage
        .from(PHOTO_BUCKET)
        .upload(path, file, { contentType: file.type })
      if (uploadError) continue

      const { error: rowError } = await admin.from('profile_photos').insert({
        profile_id: profile.id,
        image_url: path,
        status: 'pending',
        is_primary: !primaryAssigned,
      })
      if (rowError) {
        await admin.storage.from(PHOTO_BUCKET).remove([path])
        continue
      }
      primaryAssigned = true
    }
  }

  if (selfie) {
    const selfiePath = `${user.id}/selfie-${crypto.randomUUID()}.${EXTENSIONS[selfie.type]}`
    const { error: selfieError } = await admin.storage
      .from(PHOTO_BUCKET)
      .upload(selfiePath, selfie, { contentType: selfie.type })
    if (!selfieError) {
      await admin
        .from('profiles')
        .update({ verification_selfie_path: selfiePath })
        .eq('id', profile.id)
    }
  }

  const { data: currentPhotos } = await admin
    .from('profile_photos')
    .select('id, image_url, is_primary, status')
    .eq('profile_id', profile.id)
    .neq('status', 'rejected')

  const signedPhotos = await Promise.all(
    (currentPhotos ?? []).map(async (p: { id: string; image_url: string; is_primary: boolean }) => {
      const { data } = await admin.storage.from(PHOTO_BUCKET).createSignedUrl(p.image_url, 3600)
      return {
        id: p.id,
        url: data?.signedUrl ?? '',
        isPrimary: Boolean(p.is_primary),
      }
    })
  )

  revalidatePath('/onboarding/profile')
  return { success: true as const, photos: signedPhotos.filter((p) => p.url) }
}

export async function submitProfileForReview() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const [{ data: account }, { data: profile }] = await Promise.all([
    admin.from('users').select('status, phone_number, email_verified_at').eq('id', user.id).maybeSingle(),
    admin
      .from('profiles')
      .select('id, status, display_name, age, campus, rejected_at')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (account?.status !== 'active') {
    return { error: 'Your account cannot submit a profile right now.' }
  }

  if (!profile) {
    return { error: 'Complete the basics first.' }
  }

  if (profile.status === 'approved') {
    return { error: 'Your profile is already approved.' }
  }
  if (profile.status === 'pending_review') {
    return { success: true as const }
  }

  // Validate basics completeness on server
  if (!profile.display_name || !profile.age || Number(profile.age) < 18 || !profile.campus) {
    return { error: 'Complete your name, 18+ date of birth, and campus in The basics first.' }
  }
  const phone = normalizeUgandaPhone(String(account.phone_number ?? ''))
  if (!phone) {
    return { error: 'Save a valid WhatsApp number in The basics first.' }
  }
  if (await isPhoneBlocklisted(admin, phone)) {
    return { error: 'This WhatsApp number cannot be used on Silk Road.' }
  }

  // Validate at least 1 photo on server
  const { count: photoCount } = await admin
    .from('profile_photos')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profile.id)
    .neq('status', 'rejected')
  if ((photoCount ?? 0) === 0) {
    return { error: 'Add and save at least one photo before submitting.' }
  }

  // Enforce email verification at submit time (Batch 2 decision)
  const emailVerified = Boolean(account.email_verified_at || user.email_confirmed_at)
  if (!emailVerified) {
    return {
      error: 'Verify your email address before submitting your profile for review.',
      needsEmailVerification: true,
    }
  }

  const wasRejected = profile.status === 'rejected'
  const rejectedAt = profile.rejected_at as string | null | undefined
  const withinFixWindow =
    !wasRejected ||
    !rejectedAt ||
    Date.now() - new Date(rejectedAt).getTime() <= FIX_WINDOW_DAYS * 86_400_000

  const { error: submitError } = await admin
    .from('profiles')
    .update({
      status: 'pending_review',
      rejected_at: null,
      rejection_reason: null,
    })
    .eq('id', profile.id)
    .in('status', ['draft', 'rejected'])

  if (submitError) {
    return { error: 'Could not submit your profile for review. Please try again.' }
  }

  if (wasRejected && withinFixWindow) {
    await resumePausedSubscriptionsForUser(admin, user.id)
  }

  revalidatePath('/onboarding/profile')
  revalidatePath('/pending-review')
  revalidatePath('/discover')
  revalidatePath('/subscribe')
  revalidatePath('/admin/profiles')
  revalidatePath('/admin')

  return { success: true as const }
}
