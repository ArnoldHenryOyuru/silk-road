'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizeUgandaPhone } from '@/lib/phone'
import { isPhoneBlocklisted } from '@/lib/member-stage'

function calculateAge(dob: string): number {
  const birthDate = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const hadBirthday =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate())
  if (!hadBirthday) age -= 1
  return age
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: existing } = await supabase
    .from('profiles')
    .select('id, bio')
    .eq('user_id', user.id)
    .single()
  if (!existing) return { error: 'Profile not found.' }

  const displayName = String(formData.get('displayName') || '').trim()
  const dob = String(formData.get('dob') || '')
  const campus = String(formData.get('campus') || '').trim()
  const phone = String(formData.get('phone') || '').trim()
  const lookingFor = String(formData.get('lookingFor') || '').trim()
  const showMe = String(formData.get('showMe') || '').trim()
  const bio = String(formData.get('bio') || '').trim()
  const interests = formData.getAll('interests').map(String).filter(Boolean)

  // Visibility is only changed when the form sends it, so an old cached page
  // can't flip it by accident. Discreet always clears the homepage opt-in too
  // (the database enforces the same rule).
  const visibilityRaw = formData.get('visibility')
  const visibilityFields =
    visibilityRaw === 'discoverable' || visibilityRaw === 'discreet'
      ? {
          is_discoverable: visibilityRaw === 'discoverable',
          teaser_opt_in: visibilityRaw === 'discoverable' && formData.get('teaserOptIn') === '1',
        }
      : {}

  if (!displayName || !campus || !dob) {
    return { error: 'Name, date of birth, and campus are required.' }
  }
  const age = calculateAge(dob)
  if (age < 18) {
    return { error: 'You must be 18 or older to use Silk Road.' }
  }
  const normalizedPhone = normalizeUgandaPhone(phone)
  if (!normalizedPhone) {
    return { error: 'Enter a valid Ugandan mobile number (e.g. 07XXXXXXXX).' }
  }

  const admin = createAdminClient()
  if (await isPhoneBlocklisted(admin, normalizedPhone)) {
    return { error: 'This WhatsApp number cannot be used on Silk Road.' }
  }

  const { error: phoneError } = await supabase
    .from('users')
    .update({ phone_number: normalizedPhone })
    .eq('id', user.id)
  if (phoneError) {
    if (phoneError.code === '23505') {
      return { error: 'That WhatsApp number is already linked to another account.' }
    }
    return { error: 'Could not update your WhatsApp number.' }
  }

  // Campus, age, and preferences take effect immediately — no review needed.
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      display_name: displayName,
      age,
      campus,
      looking_for: lookingFor || null,
      show_me: showMe || null,
      bio: bio || null,
      interests,
      ...visibilityFields,
    })
    .eq('id', existing.id)

  if (updateError) return { error: updateError.message }

  // Bio changes go through re-review (spec §2.6) — the new text is live
  // immediately (there's no separate "pending bio" column in the schema
  // yet), but every change is logged here so moderators can audit or roll
  // one back. True "hide until approved" gating for bio would need a
  // staging column — noted as a known gap, not silently skipped.
  if ((existing.bio ?? '') !== bio) {
    const service = createServiceClient()
    await service.from('profile_edits').insert({
      profile_id: existing.id,
      field_changed: 'bio',
      old_value: existing.bio,
      new_value: bio,
      status: 'pending_review',
    })
  }

  // Photos: a slot marked for removal (existing:<id>), or a fresh file to
  // upload (new:<index>), in the same order the grid displayed them —
  // slot 0 in the final list becomes the primary photo.
  const removedPhotoIds = formData.getAll('removedPhotoIds').map(String)
  const slotOrder = formData.getAll('slotOrder').map(String) // e.g. ["existing:uuid", "new:0", ...]

  for (const photoId of removedPhotoIds) {
    const { data: photoRow } = await supabase
      .from('profile_photos')
      .select('image_url')
      .eq('id', photoId)
      .single()
    await supabase.from('profile_photos').delete().eq('id', photoId)
    if (photoRow) {
      await supabase.storage.from('profile-photos').remove([photoRow.image_url])
    }
  }

  let primaryAssigned = false
  for (const slot of slotOrder) {
    const [kind, ref] = slot.split(':')
    if (kind === 'existing') {
      await supabase.from('profile_photos').update({ is_primary: !primaryAssigned }).eq('id', ref)
      primaryAssigned = true
    } else if (kind === 'new') {
      const file = formData.get(`newPhoto:${ref}`) as File | null
      if (!file || file.size === 0) continue
      const path = `${user.id}/${crypto.randomUUID()}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(path, file, { contentType: file.type })
      if (uploadError) continue
      // New photos always enter `pending` — same re-review rule as new
      // uploads during profile creation.
      await supabase.from('profile_photos').insert({
        profile_id: existing.id,
        image_url: path,
        status: 'pending',
        is_primary: !primaryAssigned,
      })
      primaryAssigned = true
    }
  }

  return { success: true as const }
}
