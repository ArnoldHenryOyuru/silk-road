'use server'

import { createClient } from '@/lib/supabase/server'
import { normalizeUgandaPhone } from '@/lib/phone'
import { createAdminClient } from '@/lib/supabase/admin'

const PHOTO_BUCKET = 'profile-photos'
const MAX_PHOTOS = 6
// Photos are shrunk in the browser first (lib/compress-image.ts), so anything
// near this size means the browser step was skipped.
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
  const hasHadBirthdayThisYear =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate())
  if (!hasHadBirthdayThisYear) age -= 1
  return age
}

function checkImage(file: File): string | null {
  if (!EXTENSIONS[file.type]) return 'Photos must be JPG, PNG or WebP images.'
  if (file.size > MAX_FILE_BYTES) return 'One of your photos is too large. Try a smaller one.'
  return null
}

// Moves a sign-up 'draft' profile into the review queue. Members can't write
// `status` (sql/lock-down-columns.sql), so this runs with the admin client, and
// only ever from 'draft' to 'pending_review'.
async function submitDraftForReview(admin: ReturnType<typeof createAdminClient>, profileId: string) {
  const { error } = await admin
    .from('profiles')
    .update({ status: 'pending_review' })
    .eq('id', profileId)
    .eq('status', 'draft')
  if (error) {
    console.error('draft submit failed', error.code)
    return false
  }
  return true
}

export async function createProfile(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const displayName = String(formData.get('displayName') || '').trim()
  const dob = String(formData.get('dob') || '')
  const campus = String(formData.get('campus') || '').trim()
  const phone = String(formData.get('phone') || '').trim()
  const lookingFor = String(formData.get('lookingFor') || '').trim()
  const showMe = String(formData.get('showMe') || '').trim()
  const bio = String(formData.get('bio') || '').trim()
  const interests = formData.getAll('interests').map(String).filter(Boolean)
  // Visibility: "discreet" members are never listed on Discover or the public
  // homepage. The homepage opt-in only counts when the member is listed.
  const isDiscoverable = String(formData.get('visibility') || 'discoverable') !== 'discreet'
  const teaserOptIn = isDiscoverable && formData.get('teaserOptIn') === '1'
  const photos = formData.getAll('photos').filter((p): p is File => p instanceof File && p.size > 0)
  const selfieEntry = formData.get('selfie')
  const selfie = selfieEntry instanceof File && selfieEntry.size > 0 ? selfieEntry : null

  if (!displayName || !campus) {
    return { error: 'Name and campus are required.' }
  }
  if (
    displayName.length > 60 ||
    campus.length > 80 ||
    lookingFor.length > 40 ||
    showMe.length > 40 ||
    bio.length > 1000 ||
    interests.length > 20 ||
    interests.some((i) => i.length > 40)
  ) {
    return { error: 'One of your answers is too long.' }
  }
  if (!dob) {
    return { error: 'Date of birth is required.' }
  }
  const age = calculateAge(dob)
  if (!Number.isFinite(age) || age > 100) {
    return { error: 'Enter a valid date of birth.' }
  }
  if (age < 18) {
    return { error: 'You must be 18 or older to use Silk Road.' }
  }
  const normalizedPhone = normalizeUgandaPhone(phone)
  if (!normalizedPhone) {
    return { error: 'Enter a valid Ugandan mobile number (e.g. 07XXXXXXXX).' }
  }
  if (photos.length === 0) {
    return { error: 'Add at least one photo.' }
  }
  if (photos.length > MAX_PHOTOS) {
    return { error: `You can add up to ${MAX_PHOTOS} photos.` }
  }
  for (const file of selfie ? [...photos, selfie] : photos) {
    const problem = checkImage(file)
    if (problem) return { error: problem }
  }

  // The profile row may already exist: sign-up now creates a 'draft' one (name
  // only), and an earlier attempt that dropped mid-upload leaves one behind with
  // no photos. Either way this form finishes THAT row instead of failing on the
  // duplicate. Reads and writes use the admin client because members can't touch
  // `status`; every query is filtered to the signed-in user.
  const admin = createAdminClient()
  const { data: existing } = await admin.from('profiles').select('id, status').eq('user_id', user.id).maybeSingle()

  let profileId: string
  let finishingDraft = false
  if (existing) {
    const { count } = await supabase
      .from('profile_photos')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', existing.id)
    if ((count ?? 0) > 0) {
      // Photos were saved but the submit step didn't finish: just finish it.
      if (existing.status === 'draft') {
        if (!(await submitDraftForReview(admin, existing.id))) {
          return { error: 'Could not submit your profile for review. Please try again.' }
        }
        return { success: true as const }
      }
      return { error: 'Your profile has already been created.' }
    }
    profileId = existing.id
    finishingDraft = existing.status === 'draft'

    if (existing.status === 'draft' || existing.status === 'pending_review') {
      // Nothing here has been reviewed yet, so save everything from this form.
      const { error: updateError } = await admin
        .from('profiles')
        .update({
          display_name: displayName,
          age,
          campus,
          bio: bio || null,
          looking_for: lookingFor || null,
          show_me: showMe || null,
          interests,
          is_discoverable: isDiscoverable,
          teaser_opt_in: teaserOptIn,
        })
        .eq('id', existing.id)
      if (updateError) {
        console.error('profile update failed', updateError.code)
        return { error: 'Could not save your profile. Please try again.' }
      }
    } else {
      // Already reviewed (approved, rejected...): only the visibility choice may
      // change here. Bio and name changes go through Edit Profile and its review.
      await admin
        .from('profiles')
        .update({ is_discoverable: isDiscoverable, teaser_opt_in: teaserOptIn })
        .eq('id', existing.id)
    }
  } else {
    // `status` is deliberately NOT sent: the column defaults to 'pending_review'
    // (not visible on Discover until approved, §2.1, §2.2), and users must not
    // be able to write that column at all (see sql/lock-down-columns.sql).
    const { data: created, error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: user.id,
        display_name: displayName,
        age,
        campus,
        bio: bio || null,
        looking_for: lookingFor || null,
        show_me: showMe || null,
        interests,
        is_discoverable: isDiscoverable,
        teaser_opt_in: teaserOptIn,
      })
      .select('id')
      .single()

    if (profileError || !created) {
      console.error('profile insert failed', profileError?.code)
      return { error: 'Could not create your profile. Please try again.' }
    }
    profileId = created.id
  }

  const { error: phoneError } = await supabase
    .from('users')
    .update({ phone_number: normalizedPhone })
    .eq('id', user.id)
  if (phoneError) {
    if (phoneError.code === '23505') {
      return { error: 'That WhatsApp number is already linked to another account.' }
    }
    return { error: 'Could not save your phone number. Please try again.' }
  }

  let uploadedCount = 0
  for (const photo of photos) {
    // Server-chosen file name: the uploader's file name never reaches the path.
    const path = `${user.id}/${crypto.randomUUID()}.${EXTENSIONS[photo.type]}`
    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, photo, { contentType: photo.type })

    if (uploadError) continue

    // Photo enters `pending` (the column default, so it isn't sent): NSFW scan
    // + human review (§2.2, §2.6) before it's ever shown to anyone else. The
    // first successfully uploaded photo (slot order, matching the mockup's
    // "Main" badge) is marked primary.
    const { error: rowError } = await supabase.from('profile_photos').insert({
      profile_id: profileId,
      image_url: path,
      is_primary: uploadedCount === 0,
    })
    if (rowError) {
      // Don't leave a file in storage that no row points to.
      await supabase.storage.from(PHOTO_BUCKET).remove([path])
      continue
    }
    uploadedCount++
  }

  if (uploadedCount === 0) {
    return { error: 'Profile saved, but none of your photos could be uploaded. Try again.' }
  }

  if (selfie) {
    const selfiePath = `${user.id}/selfie-${crypto.randomUUID()}.${EXTENSIONS[selfie.type]}`
    const { error: selfieError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(selfiePath, selfie, { contentType: selfie.type })

    if (!selfieError) {
      // Never surface this column in a query exposed to other users —
      // it's for face-match review only (§2.1), not for display.
      await supabase.from('profiles').update({ verification_selfie_path: selfiePath }).eq('id', profileId)
    }
  }

  // Everything is saved: a draft now enters the review queue.
  // (Batch 2 adds the "email must be verified" check right here.)
  if (finishingDraft) {
    if (!(await submitDraftForReview(admin, profileId))) {
      return { error: 'Could not submit your profile for review. Please try again.' }
    }
  }

  return { success: true as const }
}
