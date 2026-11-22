'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isPhoneBlocklisted, pauseActiveSubscriptionsForUser } from '@/lib/member-stage'
import { normalizeUgandaPhone } from '@/lib/phone'

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

export async function dismissReport(reportId: string) {
  await assertAdmin()
  const service = createServiceClient()

  const { error } = await service.from('reports').update({ status: 'reviewed' }).eq('id', reportId)
  if (error) return { error: error.message }

  revalidatePath('/admin/reports')
  revalidatePath('/admin')
  return { success: true as const }
}

export async function suspendReportedUser(reportId: string, blockNumber = false) {
  const adminId = await assertAdmin()
  const service = createServiceClient()

  const { data: report } = await service
    .from('reports')
    .select('reported_user_id, reason')
    .eq('id', reportId)
    .single()
  if (!report) return { error: 'Report not found.' }

  await service.from('users').update({ status: 'suspended' }).eq('id', report.reported_user_id)
  await pauseActiveSubscriptionsForUser(service, String(report.reported_user_id))

  if (blockNumber) {
    const { data: targetUser } = await service
      .from('users')
      .select('phone_number')
      .eq('id', report.reported_user_id)
      .maybeSingle()

    const rawPhone = String(targetUser?.phone_number ?? '').trim()
    const cleanPhone = normalizeUgandaPhone(rawPhone) ?? rawPhone.replace(/[^\d]/g, '')
    if (cleanPhone && !(await isPhoneBlocklisted(service, cleanPhone))) {
      await service.from('blocked_numbers').insert({
        phone_number: cleanPhone,
        reason: report.reason ? `Report action: ${String(report.reason).slice(0, 180)}` : 'Suspended via moderation report',
        blocked_by: adminId,
      })
    }
  }

  const { error } = await service.from('reports').update({ status: 'actioned' }).eq('id', reportId)
  if (error) return { error: error.message }

  revalidatePath('/admin/reports')
  revalidatePath('/admin')
  revalidatePath('/admin/members')
  revalidatePath('/admin/payments')
  return { success: true as const }
}
