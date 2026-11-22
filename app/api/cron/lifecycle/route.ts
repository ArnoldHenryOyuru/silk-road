import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runLifecycleSweep } from '@/lib/lifecycle/sweep'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAuthorized(req: Request): boolean {
  const configured = process.env.CRON_SECRET?.trim()
  if (!configured) return false

  const header = req.headers.get('authorization') ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  const provided = match?.[1]?.trim() ?? ''
  if (!provided) return false

  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(configured, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

async function handleCron(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const summary = await runLifecycleSweep()
  return NextResponse.json({ ok: true, ...summary })
}

export async function GET(req: Request) {
  return handleCron(req)
}

export async function POST(req: Request) {
  return handleCron(req)
}
