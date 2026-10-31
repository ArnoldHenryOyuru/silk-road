import { NextRequest, NextResponse } from 'next/server'
import { settleByTrackingId } from '@/lib/payments/settle'

export const dynamic = 'force-dynamic'

const TRACKING_ID = /^[0-9a-zA-Z-]{16,64}$/

function ack(status: 200 | 500, trackingId: string, merchantReference: string, httpStatus = 200) {
  // The JSON shape Pesapal expects in reply to an IPN call.
  return NextResponse.json(
    {
      orderNotificationType: 'IPNCHANGE',
      orderTrackingId: trackingId,
      orderMerchantReference: merchantReference,
      status,
    },
    { status: httpStatus }
  )
}

/**
 * Pesapal's server-to-server notification. It is PUBLIC, so nothing in the
 * request is trusted: we only take the tracking id, then settleByTrackingId()
 * re-fetches the real status from Pesapal before changing anything.
 * Register this URL once with scripts/register-ipn.mjs (as GET).
 */
async function handle(request: NextRequest) {
  const url = new URL(request.url)
  let trackingId = url.searchParams.get('OrderTrackingId') ?? ''
  let merchantReference = url.searchParams.get('OrderMerchantReference') ?? ''

  if (request.method === 'POST') {
    const body = await request.json().catch(() => null)
    if (body && typeof body === 'object') {
      trackingId = typeof body.OrderTrackingId === 'string' ? body.OrderTrackingId : trackingId
      merchantReference =
        typeof body.OrderMerchantReference === 'string' ? body.OrderMerchantReference : merchantReference
    }
  }

  if (!TRACKING_ID.test(trackingId)) {
    return ack(500, '', '', 400)
  }

  try {
    await settleByTrackingId(trackingId)
    return ack(200, trackingId, merchantReference)
  } catch {
    // Pesapal or the database failed: tell Pesapal so it retries.
    console.error('IPN processing failed')
    return ack(500, trackingId, merchantReference, 500)
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
