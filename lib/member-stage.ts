import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export type MemberStage = 'draft' | 'pending_review' | 'approved' | 'rejected'

export const FIX_WINDOW_DAYS = 14
const FIX_WINDOW_MS = FIX_WINDOW_DAYS * 86_400_000

type Admin = ReturnType<typeof createAdminClient>

export interface MemberStageSummary {
  stage: MemberStage
  emailVerified: boolean
  profileId: string | null
  rejectionReason: string | null
  rejectedAt: string | null
  daysLeftInFixWindow: number
  fixWindowExpired: boolean
  activeSubscription: {
    id: string
    planType: string
    endDate: string
  } | null
  pausedSubscription: {
    id: string
    planType: string
    pausedAt: string | null
    remainingDays: number
  } | null
  refundRequestStatus: string | null
}

export async function isPhoneBlocklisted(admin: Admin, normalizedPhone: string): Promise<boolean> {
  const clean = normalizedPhone.replace(/^\+/, '')
  const { data } = await admin
    .from('blocked_numbers')
    .select('id')
    .in('phone_number', [clean, `+${clean}`])
    .limit(1)
  return Boolean(data && data.length > 0)
}

export async function getMemberStageSummary(
  admin: Admin,
  userId: string,
  authEmailConfirmedAt?: string | null
): Promise<MemberStageSummary> {
  const now = new Date()
  const nowIso = now.toISOString()

  const [{ data: account }, { data: profile }, { data: subs }, { data: refunds }] = await Promise.all([
    admin.from('users').select('email_verified_at').eq('id', userId).maybeSingle(),
    admin
      .from('profiles')
      .select('id, status, rejected_at, rejection_reason')
      .eq('user_id', userId)
      .maybeSingle(),
    admin
      .from('subscriptions')
      .select('id, plan_type, status, end_date, paused_at, paused_remaining_ms')
      .eq('user_id', userId)
      .in('status', ['active', 'paused'])
      .order('created_at', { ascending: false }),
    admin
      .from('refund_requests')
      .select('status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  const rawStatus = profile?.status as string | undefined
  const stage: MemberStage =
    rawStatus === 'approved' || rawStatus === 'pending_review' || rawStatus === 'rejected'
      ? rawStatus
      : 'draft'

  // Grandfather existing approved profiles so pre-Batch-2 members aren't blocked
  const emailVerified = Boolean(account?.email_verified_at || authEmailConfirmedAt || stage === 'approved')

  const rejectedAt = (profile?.rejected_at as string | null | undefined) ?? null
  let daysLeftInFixWindow = FIX_WINDOW_DAYS
  let fixWindowExpired = false
  if (stage === 'rejected' && rejectedAt) {
    const deadline = new Date(rejectedAt).getTime() + FIX_WINDOW_MS
    const remainingMs = deadline - now.getTime()
    fixWindowExpired = remainingMs <= 0
    daysLeftInFixWindow = Math.max(0, Math.ceil(remainingMs / 86_400_000))
  }

  const allSubs = (subs ?? []) as Array<{
    id: string
    plan_type: string
    status: string
    end_date: string
    paused_at?: string | null
    paused_remaining_ms?: number | null
  }>

  const activeRow = allSubs.find((s) => s.status === 'active' && s.end_date >= nowIso) ?? null
  const pausedRow = allSubs.find((s) => s.status === 'paused') ?? null

  return {
    stage,
    emailVerified,
    profileId: profile?.id ? String(profile.id) : null,
    rejectionReason: (profile?.rejection_reason as string | null | undefined) ?? null,
    rejectedAt,
    daysLeftInFixWindow,
    fixWindowExpired,
    activeSubscription: activeRow
      ? { id: activeRow.id, planType: activeRow.plan_type, endDate: activeRow.end_date }
      : null,
    pausedSubscription: pausedRow
      ? {
          id: pausedRow.id,
          planType: pausedRow.plan_type,
          pausedAt: pausedRow.paused_at ?? null,
          remainingDays: Math.max(1, Math.ceil(Number(pausedRow.paused_remaining_ms ?? 0) / 86_400_000)),
        }
      : null,
    refundRequestStatus: refunds?.[0]?.status ? String(refunds[0].status) : null,
  }
}

export async function pauseActiveSubscriptionsForUser(admin: Admin, userId: string): Promise<void> {
  const now = new Date()
  const nowIso = now.toISOString()

  const { data: activeSubs } = await admin
    .from('subscriptions')
    .select('id, end_date')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gte('end_date', nowIso)

  for (const sub of activeSubs ?? []) {
    const remainingMs = Math.max(0, new Date(sub.end_date).getTime() - now.getTime())
    await admin
      .from('subscriptions')
      .update({
        status: 'paused',
        paused_at: nowIso,
        paused_remaining_ms: remainingMs,
      })
      .eq('id', sub.id)
  }
}

export async function resumePausedSubscriptionsForUser(admin: Admin, userId: string): Promise<void> {
  const { data: pausedSubs } = await admin
    .from('subscriptions')
    .select('id, paused_remaining_ms')
    .eq('user_id', userId)
    .eq('status', 'paused')

  const now = Date.now()
  for (const sub of pausedSubs ?? []) {
    const remainingMs = Math.max(0, Number(sub.paused_remaining_ms ?? 0))
    if (remainingMs <= 0) continue
    await admin
      .from('subscriptions')
      .update({
        status: 'active',
        end_date: new Date(now + remainingMs).toISOString(),
        paused_at: null,
        paused_remaining_ms: null,
      })
      .eq('id', sub.id)
  }
}
