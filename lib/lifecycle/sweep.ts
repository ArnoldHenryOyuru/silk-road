import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { sendDraftReminderEmail, sendRecoveryExpiredEmail } from '@/lib/email/mailer'

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

export interface LifecycleSweepResult {
  draftNudgesSent: number
  expiredSubscriptions: number
  ranAt: string
}

export async function runLifecycleSweep(): Promise<LifecycleSweepResult> {
  const service = createServiceClient()
  const now = new Date()
  const nowIso = now.toISOString()
  const draftCutoff = new Date(now.getTime() - 24 * HOUR_MS).toISOString()
  const recoveryCutoff = new Date(now.getTime() - 14 * DAY_MS).toISOString()

  let draftNudgesSent = 0
  let expiredSubscriptions = 0

  // 1. Send one-time 24-hour draft checklist reminder emails
  const { data: staleDrafts } = await service
    .from('profiles')
    .select('id, user_id, display_name')
    .eq('status', 'draft')
    .lt('created_at', draftCutoff)
    .is('draft_nudged_at', null)
    .limit(100)

  const draftRows = (staleDrafts ?? []) as Array<{
    id: string
    user_id: string
    display_name: string | null
  }>

  if (draftRows.length > 0) {
    const draftUserIds = [...new Set(draftRows.map((d) => String(d.user_id)).filter(Boolean))]
    const { data: users } = await service
      .from('users')
      .select('id, email, status')
      .in('id', draftUserIds)
      .eq('status', 'active')

    const emailByUser = new Map<string, string>()
    for (const u of (users ?? []) as Array<{ id: string; email: string | null }>) {
      if (u.email) emailByUser.set(String(u.id), String(u.email))
    }

    for (const draft of draftRows) {
      const email = emailByUser.get(String(draft.user_id))
      if (email) {
        await sendDraftReminderEmail({
          to: email,
          displayName: draft.display_name ?? 'there',
        })
      }

      const { error: markErr } = await service
        .from('profiles')
        .update({ draft_nudged_at: nowIso })
        .eq('id', draft.id)
        .is('draft_nudged_at', null)

      if (!markErr && email) {
        draftNudgesSent += 1
      }
    }
  }

  // 2. Expire paused subscriptions for rejected profiles past their 14-day recovery window
  const { data: expiredRejected } = await service
    .from('profiles')
    .select('id, user_id, display_name')
    .eq('status', 'rejected')
    .not('rejected_at', 'is', null)
    .lt('rejected_at', recoveryCutoff)
    .limit(100)

  const rejectedRows = (expiredRejected ?? []) as Array<{
    id: string
    user_id: string
    display_name: string | null
  }>

  if (rejectedRows.length > 0) {
    const rejectedUserIds = [...new Set(rejectedRows.map((r) => String(r.user_id)).filter(Boolean))]
    const { data: pausedSubs } = await service
      .from('subscriptions')
      .select('id, user_id, plan_type')
      .in('user_id', rejectedUserIds)
      .eq('status', 'paused')

    const subRows = (pausedSubs ?? []) as Array<{
      id: string
      user_id: string
      plan_type: string
    }>

    if (subRows.length > 0) {
      const { data: users } = await service
        .from('users')
        .select('id, email')
        .in('id', [...new Set(subRows.map((s) => String(s.user_id)))])

      const emailByUser = new Map<string, string>()
      for (const u of (users ?? []) as Array<{ id: string; email: string | null }>) {
        if (u.email) emailByUser.set(String(u.id), String(u.email))
      }

      const nameByUser = new Map<string, string>()
      for (const r of rejectedRows) {
        nameByUser.set(String(r.user_id), r.display_name ?? 'there')
      }

      for (const sub of subRows) {
        const { error: subErr } = await service
          .from('subscriptions')
          .update({ status: 'expired', paused_at: null, paused_remaining_ms: null })
          .eq('id', sub.id)
          .eq('status', 'paused')

        if (!subErr) {
          expiredSubscriptions += 1
          const email = emailByUser.get(String(sub.user_id))
          if (email) {
            await sendRecoveryExpiredEmail({
              to: email,
              displayName: nameByUser.get(String(sub.user_id)) ?? 'there',
              planType: sub.plan_type || 'membership',
            })
          }
        }
      }
    }
  }

  return {
    draftNudgesSent,
    expiredSubscriptions,
    ranAt: nowIso,
  }
}
