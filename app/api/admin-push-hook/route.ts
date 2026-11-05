import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { notifyAdmins, type PushPayload } from '@/lib/push/send'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Hook = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: Record<string, any> | null
  old_record: Record<string, any> | null
}

export async function POST(req: Request) {
  const secret = process.env.ADMIN_PUSH_WEBHOOK_SECRET
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const hook = (await req.json()) as Hook
  const r = hook.record
  if (!r || hook.type === 'DELETE') return NextResponse.json({ ok: true })

  const old = hook.old_record
  const service = createServiceClient()
  // True only when the row has just entered this status (new row, or status changed)
  const entered = (status: string) => r.status === status && old?.status !== status

  const nameOf = async (column: 'id' | 'user_id', value: string) => {
    const { data } = await service.from('profiles').select('display_name').eq(column, value).maybeSingle()
    return data?.display_name ?? 'A member'
  }

  let payload: PushPayload | null = null

  switch (hook.table) {
    case 'profiles':
      if (entered('pending_review')) {
        payload = {
          title: 'New profile to review',
          body: `${r.display_name ?? 'A new member'}${r.campus ? `, ${r.campus}` : ''}`,
          url: '/admin/profiles',
          tag: 'profiles',
        }
      }
      break
    case 'profile_photos':
      if (entered('pending')) {
        payload = {
          title: 'New photo to review',
          body: `${await nameOf('id', r.profile_id)} uploaded a photo`,
          url: '/admin/photos',
          tag: 'photos',
        }
      }
      break
    case 'profile_edits':
      if (entered('pending_review')) {
        payload = {
          title: 'Bio edit to review',
          body: `${await nameOf('id', r.profile_id)} changed their ${r.field_changed ?? 'profile'}`,
          url: '/admin/edits',
          tag: 'edits',
        }
      }
      break
    case 'reports':
      if (entered('open')) {
        payload = {
          title: 'New report',
          body: r.reason ? String(r.reason).slice(0, 120) : 'A member was reported',
          url: '/admin/reports',
        }
      }
      break
    case 'subscriptions':
      if (hook.type === 'INSERT' && r.status === 'active') {
        payload = {
          title: 'Payment received',
          body: `${await nameOf('user_id', r.user_id)} started a ${r.plan_type} plan`,
          url: '/admin/payments',
        }
      }
      break
  }

  if (payload) await notifyAdmins(payload)
  return NextResponse.json({ ok: true })
}
