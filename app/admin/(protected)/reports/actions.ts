'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

async function assertAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!data?.is_admin) throw new Error('Not authorized')
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

export async function suspendReportedUser(reportId: string) {
  await assertAdmin()
  const service = createServiceClient()

  const { data: report } = await service.from('reports').select('reported_user_id').eq('id', reportId).single()
  if (!report) return { error: 'Report not found.' }

  await service.from('users').update({ status: 'suspended' }).eq('id', report.reported_user_id)

  const { error } = await service.from('reports').update({ status: 'actioned' }).eq('id', reportId)
  if (error) return { error: error.message }

  revalidatePath('/admin/reports')
  revalidatePath('/admin')
  return { success: true as const }
}
