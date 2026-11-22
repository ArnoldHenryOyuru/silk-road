'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export interface AdminRefundRequestRow {
  id: string
  userId: string
  subscriptionId: string
  memberName: string
  amount: number
  currency: string
  reason: string
  status: string
  payoutRef: string | null
  adminNote: string | null
  reviewedAt: string | null
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

export async function processRefundRequest(
  refundId: string,
  decision: 'refunded' | 'declined',
  metadata?: { payoutRef?: string; adminNote?: string }
): Promise<{
  error?: string
  status?: 'refunded' | 'declined'
  payoutRef?: string | null
  adminNote?: string | null
  reviewedAt?: string
}> {
  const adminId = await assertAdmin()
  const service = createServiceClient()

  const { data: reqRow } = await service
    .from('refund_requests')
    .select('id, subscription_id, status')
    .eq('id', refundId)
    .maybeSingle()

  if (!reqRow) return { error: 'Refund request not found.' }
  if (reqRow.status !== 'pending') {
    return { error: 'This refund request has already been processed.' }
  }

  const cleanPayoutRef =
    decision === 'refunded' ? metadata?.payoutRef?.trim().slice(0, 120) || null : null
  const cleanAdminNote = metadata?.adminNote?.trim().slice(0, 300) || null
  const reviewedAt = new Date().toISOString()

  const { error: updateErr } = await service
    .from('refund_requests')
    .update({
      status: decision,
      payout_ref: cleanPayoutRef,
      admin_note: cleanAdminNote,
      reviewed_by: adminId,
      reviewed_at: reviewedAt,
    })
    .eq('id', refundId)

  if (updateErr) return { error: updateErr.message }

  if (reqRow.subscription_id) {
    await service
      .from('subscriptions')
      .update({ status: decision === 'refunded' ? 'cancelled' : 'paused' })
      .eq('id', reqRow.subscription_id)
  }

  revalidatePath('/admin/payments')
  revalidatePath('/admin')
  revalidatePath('/pending-review')
  revalidatePath('/subscribe')
  return {
    status: decision,
    payoutRef: cleanPayoutRef,
    adminNote: cleanAdminNote,
    reviewedAt,
  }
}
