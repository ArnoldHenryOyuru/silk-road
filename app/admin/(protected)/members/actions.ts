'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isPhoneBlocklisted } from '@/lib/member-stage'
import { normalizeUgandaPhone } from '@/lib/phone'

export interface BlockedNumberRow {
  id: string
  phoneNumber: string
  reason: string
  createdAt: string
}

async function assertAdmin(): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!data?.is_admin) throw new Error('Not authorized')
  return user.id
}

export async function addBlockedNumber(
  rawPhone: string,
  rawReason: string
): Promise<{ error?: string; item?: BlockedNumberRow }> {
  const adminId = await assertAdmin()
  const normalized = normalizeUgandaPhone(rawPhone.trim())
  if (!normalized) {
    return { error: 'Enter a valid Ugandan mobile number (e.g. 07XXXXXXXX or 2567XXXXXXXX).' }
  }

  const service = createServiceClient()
  if (await isPhoneBlocklisted(service, normalized)) {
    return { error: 'That WhatsApp number is already on the blocklist.' }
  }

  const reason = rawReason.trim().slice(0, 240) || 'Blocked by admin'

  const { data, error } = await service
    .from('blocked_numbers')
    .insert({
      phone_number: normalized,
      reason,
      blocked_by: adminId,
    })
    .select('id, phone_number, reason, created_at')
    .single()

  if (error || !data) {
    return { error: error?.message ?? 'Could not add number to the blocklist.' }
  }

  revalidatePath('/admin/members')
  return {
    item: {
      id: String(data.id),
      phoneNumber: String(data.phone_number),
      reason: String(data.reason ?? reason),
      createdAt: String(data.created_at ?? new Date().toISOString()),
    },
  }
}

export async function removeBlockedNumber(id: string): Promise<{ error?: string; success?: true }> {
  await assertAdmin()
  const service = createServiceClient()

  const { error } = await service.from('blocked_numbers').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/members')
  return { success: true }
}
