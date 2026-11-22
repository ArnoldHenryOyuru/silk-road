'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendMemberDecisionEmail } from '@/lib/email/mailer'
import {
  pauseActiveSubscriptionsForUser,
  resumePausedSubscriptionsForUser,
} from '@/lib/member-stage'

async function assertAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!data?.is_admin) throw new Error('Not authorized')
}

async function notifyMemberDecision(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  displayName: string,
  approved: boolean,
  rejectionReason?: string | null
) {
  try {
    const { data: account } = await service
      .from('users')
      .select('email')
      .eq('id', userId)
      .maybeSingle()
    if (!account?.email) return
    await sendMemberDecisionEmail({
      to: String(account.email),
      displayName,
      approved,
      rejectionReason,
    })
  } catch (err) {
    console.warn('member decision email failed (non-blocking):', err)
  }
}

export async function approveProfile(profileId: string) {
  await assertAdmin()
  const service = createServiceClient()

  const { data: profile } = await service
    .from('profiles')
    .select('user_id, display_name')
    .eq('id', profileId)
    .maybeSingle()

  const { error } = await service
    .from('profiles')
    .update({ status: 'approved', rejected_at: null, rejection_reason: null })
    .eq('id', profileId)
  if (error) return { error: error.message }

  if (profile?.user_id) {
    await resumePausedSubscriptionsForUser(service, String(profile.user_id))
    await notifyMemberDecision(
      service,
      String(profile.user_id),
      String(profile.display_name ?? 'there'),
      true
    )
  }

  revalidatePath('/admin/profiles')
  revalidatePath('/admin')
  revalidatePath('/admin/members')
  return { success: true as const }
}

export async function rejectProfile(profileId: string, reason?: string) {
  await assertAdmin()
  const service = createServiceClient()

  const { data: profile } = await service
    .from('profiles')
    .select('user_id, display_name')
    .eq('id', profileId)
    .maybeSingle()

  const cleanReason = reason?.trim().slice(0, 300) || null

  const { error } = await service
    .from('profiles')
    .update({
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      rejection_reason: cleanReason,
    })
    .eq('id', profileId)
  if (error) return { error: error.message }

  if (profile?.user_id) {
    await pauseActiveSubscriptionsForUser(service, String(profile.user_id))
    await notifyMemberDecision(
      service,
      String(profile.user_id),
      String(profile.display_name ?? 'there'),
      false,
      cleanReason
    )
  }

  revalidatePath('/admin/profiles')
  revalidatePath('/admin')
  revalidatePath('/admin/members')
  revalidatePath('/admin/payments')
  return { success: true as const }
}
