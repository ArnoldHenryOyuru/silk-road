import 'server-only'
import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLANS, isPlanId } from '@/lib/payments/plans'
import type { MemberStage } from '@/lib/member-stage'

/**
 * The ONE place a phone number is turned into a WhatsApp link. Every screen that
 * offers "Contact via WhatsApp" must go through unlockContact(), so the rules
 * below can't be skipped by calling a different copy of the logic.
 *
 * Daily limits come from the subscriber's plan (lib/payments/plans.ts:
 * dailyContacts) and count DIFFERENT people per day. Pending members are
 * capped at 1 contact/day until approved; draft and rejected members cannot
 * unlock contacts. The day resets at midnight Kampala time (UTC+3).
 */

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000
const PENDING_DAILY_CAP = 1

type Admin = ReturnType<typeof createAdminClient>

export type ContactAllowance = {
  subscribed: boolean
  stage: MemberStage
  isPendingCap: boolean
  planLimit: number
  limit: number // effective contacts per day (0 if not subscribed or draft/rejected)
  used: number // different people unlocked so far today
  remaining: number
}

export type ContactResult =
  | { ok: true; url: string; remaining: number; limit: number }
  | { ok: false; reason: 'not_subscribed' | 'not_found' | 'profile_not_approved' | 'profile_rejected' }
  | { ok: false; reason: 'rate_limited'; limit: number }

const NOT_FOUND: ContactResult = { ok: false, reason: 'not_found' }

function startOfTodayEat(now: Date): Date {
  const shifted = new Date(now.getTime() + EAT_OFFSET_MS)
  const midnightShifted = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate())
  return new Date(midnightShifted - EAT_OFFSET_MS)
}

async function loadAllowance(admin: Admin, viewerId: string, now: Date) {
  const [{ data: subs }, { data: recent }, { data: mine }] = await Promise.all([
    admin
      .from('subscriptions')
      .select('plan_type')
      .eq('user_id', viewerId)
      .eq('status', 'active')
      .gte('end_date', now.toISOString()),
    admin
      .from('phone_unlock_events')
      .select('profile_id')
      .eq('viewer_id', viewerId)
      .gte('created_at', startOfTodayEat(now).toISOString()),
    admin.from('profiles').select('status').eq('user_id', viewerId).maybeSingle(),
  ])

  const rawStatus = mine?.status as string | undefined
  const stage: MemberStage =
    rawStatus === 'approved' || rawStatus === 'pending_review' || rawStatus === 'rejected'
      ? rawStatus
      : 'draft'

  const activeRows: { plan_type: string }[] = subs ?? []
  const limits = activeRows
    .map((row) => row.plan_type)
    .filter(isPlanId)
    .map((plan) => PLANS[plan].dailyContacts as number)
  const planLimit = limits.length > 0 ? Math.max(...limits) : 0

  let limit = 0
  if (stage === 'approved') {
    limit = planLimit
  } else if (stage === 'pending_review') {
    limit = Math.min(planLimit, PENDING_DAILY_CAP)
  }

  const unlockedToday = new Set<string>((recent ?? []).map((row: { profile_id: string }) => row.profile_id))
  const used = unlockedToday.size
  const isPendingCap = stage === 'pending_review' && planLimit > PENDING_DAILY_CAP

  const allowance: ContactAllowance = {
    subscribed: activeRows.length > 0,
    stage,
    isPendingCap,
    planLimit,
    limit,
    used,
    remaining: Math.max(0, limit - used),
  }
  return { allowance, unlockedToday }
}

/** For screens that show remaining daily contacts. Reads only the viewer's own data. */
export const getContactAllowance = cache(async (viewerId: string): Promise<ContactAllowance> => {
  const { allowance } = await loadAllowance(createAdminClient(), viewerId, new Date())
  return allowance
})

export async function unlockContact(viewerId: string, profileId: string): Promise<ContactResult> {
  const admin = createAdminClient()
  const now = new Date()

  // 1. The viewer's account must be active.
  const { data: viewer } = await admin.from('users').select('status').eq('id', viewerId).maybeSingle()
  if (viewer?.status !== 'active') return NOT_FOUND

  // 2. Stage & subscription check.
  const { allowance, unlockedToday } = await loadAllowance(admin, viewerId, now)
  if (allowance.stage === 'draft') {
    return { ok: false, reason: 'profile_not_approved' }
  }
  if (allowance.stage === 'rejected') {
    return { ok: false, reason: 'profile_rejected' }
  }
  if (!allowance.subscribed) {
    return { ok: false, reason: 'not_subscribed' }
  }

  // 3. The target: an approved, listed (not discreet) profile, not the viewer's own.
  const { data: target } = await admin
    .from('profiles')
    .select('display_name, user_id, status, is_discoverable')
    .eq('id', profileId)
    .maybeSingle()
  if (!target || target.status !== 'approved' || target.is_discoverable === false || target.user_id === viewerId)
    return NOT_FOUND

  // 4. The target's account must be active and have a number.
  const { data: targetUser } = await admin
    .from('users')
    .select('status, phone_number')
    .eq('id', target.user_id)
    .maybeSingle()
  if (targetUser?.status !== 'active' || !targetUser.phone_number) return NOT_FOUND

  // 5. No block in either direction.
  const { data: blocks } = await admin
    .from('blocks')
    .select('id')
    .or(
      `and(blocker_id.eq.${viewerId},blocked_id.eq.${target.user_id}),` +
        `and(blocker_id.eq.${target.user_id},blocked_id.eq.${viewerId})`
    )
    .limit(1)
  if (blocks && blocks.length > 0) return NOT_FOUND

  // 6. Today's limit (1/day if pending_review, plan limit if approved).
  const alreadyUnlocked = unlockedToday.has(profileId)
  if (!alreadyUnlocked && allowance.remaining <= 0) {
    return { ok: false, reason: 'rate_limited', limit: allowance.limit }
  }

  // 7. Log BEFORE releasing the number.
  const { error: logError } = await admin.from('phone_unlock_events').insert({
    viewer_id: viewerId,
    profile_id: profileId,
  })
  if (logError) {
    console.error('phone_unlock_events insert failed')
    return NOT_FOUND
  }

  const usedAfter = alreadyUnlocked ? allowance.used : allowance.used + 1
  const firstName = target.display_name.split(' ')[0]
  const message = encodeURIComponent(`Hey ${firstName}, I found your profile on Silk Road 👋`)
  const digits = targetUser.phone_number.replace(/[^\d]/g, '')

  return {
    ok: true,
    url: `https://wa.me/${digits}?text=${message}`,
    remaining: Math.max(0, allowance.limit - usedAfter),
    limit: allowance.limit,
  }
}
