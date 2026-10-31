import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhook } from '@/lib/nylon'
import { settleNylonByReference, type SignedPayload } from '@/lib/payments/settle-nylon'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

/**
 * Nylon Pay's server-to-server notification. Public URL, so:
 *  1. the signature is checked against the RAW body first (401 if wrong);
 *  2. only the reference is taken, and settleNylonByReference() re-fetches the
 *     real status from Nylon before anything changes;
 *  3. deliveries arrive at least once, which is harmless: activation is
 *     idempotent in the database.
 * Answer 2xx within 10 seconds, or Nylon retries. Set this URL and the secret on
 * the API key in the Nylon dashboard (API Settings, Webhook Configuration):
 *   https://silkroadug.vercel.app/api/nylon/webhook
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-nylon-signature') ?? ''

  if (!verifyWebhook(rawBody, signature)) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const payload = asRecord(asRecord(body).payload)
  const reference = typeof payload.reference === 'string' ? payload.reference : ''

  // Not one of our collections (a payout, or another system's reference):
  // acknowledge so Nylon stops retrying.
  if (!UUID.test(reference) || (payload.type && payload.type !== 'collection')) {
    return NextResponse.json({ ok: true })
  }

  const amount = Number(payload.amount)
  const signed: SignedPayload = {
    amount: Number.isFinite(amount) ? amount : undefined,
    currency: typeof payload.currency === 'string' ? payload.currency : undefined,
    transactionId: typeof payload.transactionId === 'string' ? payload.transactionId : undefined,
    method: typeof payload.method === 'string' ? payload.method : undefined,
  }

  try {
    await settleNylonByReference(reference, signed)
    return NextResponse.json({ ok: true })
  } catch {
    console.error('Nylon webhook processing failed')
    return NextResponse.json({ ok: false }, { status: 500 }) // Nylon retries
  }
}
