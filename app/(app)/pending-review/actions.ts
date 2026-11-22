'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FIX_WINDOW_DAYS } from '@/lib/member-stage'
import { PLANS, CURRENCY, isPlanId } from '@/lib/payments/plans'

export async function requestRejectionRefund(subscriptionId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const [{ data: profile }, { data: sub }, { data: existingRefund }] = await Promise.all([
    admin
      .from('profiles')
      .select('status, rejected_at, rejection_reason')
      .eq('user_id', user.id)
      .maybeSingle(),
    admin
      .from('subscriptions')
      .select('id, user_id, plan_type, status')
      .eq('id', subscriptionId)
      .eq('user_id', user.id)
      .maybeSingle(),
    admin
      .from('refund_requests')
      .select('id, status')
      .eq('subscription_id', subscriptionId)
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (profile?.status !== 'rejected') {
    return { error: 'Refund requests on this screen are only for rejected profiles.' }
  }

  if (profile.rejected_at) {
    const deadline = new Date(String(profile.rejected_at)).getTime() + FIX_WINDOW_DAYS * 86_400_000
    if (Date.now() > deadline) {
      return { error: 'The 14-day refund window for this review has ended.' }
    }
  }

  if (!sub || (sub.status !== 'paused' && sub.status !== 'active')) {
    return { error: 'No eligible subscription was found for this refund.' }
  }

  if (existingRefund) {
    return { error: 'A refund request has already been submitted for this plan.' }
  }

  const amount = isPlanId(sub.plan_type) ? PLANS[sub.plan_type].amount : 0

  const { error: insertError } = await admin.from('refund_requests').insert({
    user_id: user.id,
    subscription_id: sub.id,
    amount,
    currency: CURRENCY,
    reason: profile.rejection_reason || 'Profile rejected during review',
    status: 'pending',
  })

  if (insertError) {
    return { error: 'Could not submit your refund request. Please try again.' }
  }

  await admin.from('subscriptions').update({ status: 'refund_requested' }).eq('id', sub.id)

  revalidatePath('/pending-review')
  revalidatePath('/subscribe')
  revalidatePath('/admin/payments')
  return { success: true as const }
}
