import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLANS, isPlanId } from '@/lib/payments/plans'

/**
 * The ONE place a phone number is turned into a WhatsApp link. Every screen that
 * offers "Contact via WhatsApp" must go through unlockContact(), so the rules
 * below can't be skipped by calling a different copy of the logic.
 *
 * Daily limits come from the subscriber's plan (lib/payments/plans.ts:
 * dailyContacts) and count DIFFERENT people per day. The day resets at midnight
 * Kampala time (UTC+3, no daylight saving).
 */

// "Verified" in the spec: the viewer's own profile must have passed review.
// (Not face_match_verified: nothing reviews selfies yet, so requiring it would
// lock everyone out. Switch to that when the selfie review screen exists.)
const REQUIRE_APPROVED_PROFILE = true

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000

type Admin = ReturnType<typeof createAdminClient>

export type ContactAllowance = {
  subscribed: boolean
  limit: number // contacts per day on the viewer's plan (0 if not subscribed)
  used: number // different people unlocked so far today
  remaining: number
}

export type ContactResult =
  | { ok: true; url: string; remaining: number; limit: number }
  | { ok: false; reason: 'not_subscribed' | 'not_found' | 'profile_not_approved' }
  | { ok: false; reason: 'rate_limited'; limit: number }

// Every denial about the OTHER person (blocked, suspended, deactivated, not
// approved, no number) returns the same vague answer, so a caller can't use the
// response to learn who blocked them or who is suspended.
const NOT_FOUND: ContactResult = { ok: false, reason: 'not_found' }

function startOfTodayEat(now: Date): Date {
  const shifted = new Date(now.getTime() + EAT_OFFSET_MS)
  const midnightShifted = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate())
  return new Date(midnightShifted - EAT_OFFSET_MS)
}

async function loadAllowance(admin: Admin, viewerId: string, now: Date) {
  const { data: subs } = await admin
    .from('subscriptions')
    .select('plan_type')
    .eq('user_id', viewerId)
    .eq('status', 'active')
    .gte('end_date', now.toISOString())

  const activeRows: { plan_type: string }[] = subs ?? []
  const limits = activeRows
    .map((row) => row.plan_type)
    .filter(isPlanId)
    .map((plan) => PLANS[plan].dailyContacts as number)
  // If someone ever has two overlapping plans, the better one applies.
  const limit = limits.length > 0 ? Math.max(...limits) : 0

  const { data: recent } = await admin
    .from('phone_unlock_events')
    .select('profile_id')
    .eq('viewer_id', viewerId)
    .gte('created_at', startOfTodayEat(now).toISOString())
  const unlockedToday = new Set<string>((recent ?? []).map((row: { profile_id: string }) => row.profile_id))

  const used = unlockedToday.size
  const allowance: ContactAllowance = {
    subscribed: activeRows.length > 0,
    limit,
    used,
    remaining: Math.max(0, limit - used),
  }
  return { allowance, unlockedToday }
}

/** For screens that show "2 of 5 contacts left today". Reads only the viewer's own data. */
export async function getContactAllowance(viewerId: string): Promise<ContactAllowance> {
  const { allowance } = await loadAllowance(createAdminClient(), viewerId, new Date())
  return allowance
}

export async function unlockContact(viewerId: string, profileId: string): Promise<ContactResult> {
  const admin = createAdminClient()
  const now = new Date()

  // 1. The viewer's account must be active (deactivated, suspended, banned or
  //    mid-deletion accounts have their contact ability frozen).
  const { data: viewer } = await admin.from('users').select('status').eq('id', viewerId).maybeSingle()
  if (viewer?.status !== 'active') return NOT_FOUND

  // 2. Subscribed, and what the plan allows per day.
  const { allowance, unlockedToday } = await loadAllowance(admin, viewerId, now)
  if (!allowance.subscribed) return { ok: false, reason: 'not_subscribed' }

  // 3. "Verified": the viewer's own profile has been approved.
  if (REQUIRE_APPROVED_PROFILE) {
    const { data: mine } = await admin.from('profiles').select('status').eq('user_id', viewerId).maybeSingle()
    if (mine?.status !== 'approved') return { ok: false, reason: 'profile_not_approved' }
  }

  // 4. The target: an approved profile, not the viewer's own.
  const { data: target } = await admin
    .from('profiles')
    .select('display_name, user_id, status')
    .eq('id', profileId)
    .maybeSingle()
  if (!target || target.status !== 'approved' || target.user_id === viewerId) return NOT_FOUND

  // 5. The target's account must be active and have a number.
  const { data: targetUser } = await admin
    .from('users')
    .select('status, phone_number')
    .eq('id', target.user_id)
    .maybeSingle()
  if (targetUser?.status !== 'active' || !targetUser.phone_number) return NOT_FOUND

  // 6. No block in either direction.
  const { data: blocks } = await admin
    .from('blocks')
    .select('id')
    .or(
      `and(blocker_id.eq.${viewerId},blocked_id.eq.${target.user_id}),` +
        `and(blocker_id.eq.${target.user_id},blocked_id.eq.${viewerId})`
    )
    .limit(1)
  if (blocks && blocks.length > 0) return NOT_FOUND

  // 7. Today's limit, on different people. Someone already unlocked today can be
  //    reopened without using another contact.
  const alreadyUnlocked = unlockedToday.has(profileId)
  if (!alreadyUnlocked && allowance.remaining <= 0) {
    return { ok: false, reason: 'rate_limited', limit: allowance.limit }
  }

  // 8. Log it BEFORE handing out the number (spec: highest-scrutiny event). If
  //    the log can't be written, the number isn't released.
  const { error: logError } = await admin.from('phone_unlock_events').insert({
    viewer_id: viewerId,
    profile_id: profileId,
  })
  if (logError) {
    console.error('phone_unlock_events insert failed') // never log the number itself
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
