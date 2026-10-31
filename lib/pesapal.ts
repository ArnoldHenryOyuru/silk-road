import 'server-only'

/**
 * Minimal Pesapal API 3.0 client (server only).
 * Env: PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET, PESAPAL_BASE_URL
 *   live:    https://pay.pesapal.com/v3
 *   sandbox: https://cybqa.pesapal.com/pesapalv3
 * Never log the key, the secret or the token.
 */

function config() {
  const key = process.env.PESAPAL_CONSUMER_KEY
  const secret = process.env.PESAPAL_CONSUMER_SECRET
  const base = process.env.PESAPAL_BASE_URL
  if (!key || !secret || !base) throw new Error('Missing Pesapal environment variables')
  return { key, secret, base: base.replace(/\/+$/, '') }
}

type PesapalError = { code?: string | null; message?: string | null } | null | undefined
function hasError(error: PesapalError) {
  return !!(error && (error.code || error.message))
}

let cached: { token: string; expiresAt: number } | null = null

async function getToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token

  const { key, secret, base } = config()
  const res = await fetch(`${base}/api/Auth/RequestToken`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ consumer_key: key, consumer_secret: secret }),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.token || hasError(data.error)) throw new Error('Pesapal authentication failed')

  // Tokens last about 5 minutes; refresh a little early.
  const parsed = Date.parse(data.expiryDate)
  const fallback = Date.now() + 4 * 60_000
  cached = { token: data.token, expiresAt: Number.isFinite(parsed) ? Math.min(parsed, fallback) : fallback }
  return data.token
}

async function authHeaders() {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${await getToken()}`,
  }
}

export async function submitOrder(input: {
  merchantReference: string
  amount: number
  currency: string
  description: string
  callbackUrl: string
  ipnId: string
  email: string
}): Promise<{ orderTrackingId: string; redirectUrl: string }> {
  const { base } = config()
  const res = await fetch(`${base}/api/Transactions/SubmitOrderRequest`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      id: input.merchantReference,
      currency: input.currency,
      amount: input.amount,
      description: input.description.slice(0, 100),
      callback_url: input.callbackUrl,
      notification_id: input.ipnId,
      billing_address: { email_address: input.email, country_code: 'UG' },
    }),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.order_tracking_id || !data?.redirect_url || hasError(data.error)) {
    throw new Error('Pesapal order request failed')
  }
  return { orderTrackingId: data.order_tracking_id, redirectUrl: data.redirect_url }
}

export type PesapalTransactionStatus = {
  payment_method: string | null
  amount: number
  confirmation_code: string | null
  payment_status_description: string | null
  status_code: number // 0 INVALID, 1 COMPLETED, 2 FAILED, 3 REVERSED
  merchant_reference: string
  currency: string
}

export async function getTransactionStatus(orderTrackingId: string): Promise<PesapalTransactionStatus> {
  const { base } = config()
  const res = await fetch(
    `${base}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
    { method: 'GET', headers: await authHeaders(), cache: 'no-store' }
  )
  const data = await res.json().catch(() => null)
  if (!res.ok || !data || hasError(data.error) || typeof data.status_code !== 'number' || !data.merchant_reference) {
    throw new Error('Pesapal status lookup failed')
  }
  return data as PesapalTransactionStatus
}
