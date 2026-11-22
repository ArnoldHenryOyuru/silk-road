import 'server-only'
import { createNylonPay } from '@nile-squad/nylonpay-ts'
import { CURRENCY } from '@/lib/payments/plans'

/**
 * Thin wrapper around the Nylon Pay TypeScript SDK. Every SDK call lives here,
 * so if the SDK's types differ from the docs, this is the only file to adjust.
 *
 * Env (never commit or paste these):
 *   NYLONPAY_API_KEY, NYLONPAY_API_SECRET   npk_test_... / nps_test_... (sandbox)
 *                                            npk_live_... / nps_live_... (live)
 *   NYLONPAY_WEBHOOK_SECRET                 set on the same key in the dashboard
 *   NYLONPAY_TEST_OUTCOME                   sandbox only: success (default) | fail | pin
 *
 * Use a LIVE key for the SDK, not "Live (REST)": REST live keys require fixed
 * allowed IP addresses, which Vercel functions don't have.
 */

type Client = ReturnType<typeof createNylonPay>
let client: Client | null = null

export function isNylonConfigured(): boolean {
  return Boolean(
    process.env.NYLONPAY_API_KEY?.trim() && process.env.NYLONPAY_API_SECRET?.trim()
  )
}

function nylon(): Client {
  if (client) return client
  const apiKey = process.env.NYLONPAY_API_KEY
  const apiSecret = process.env.NYLONPAY_API_SECRET
  if (!apiKey || !apiSecret) throw new Error('Missing Nylon Pay environment variables')
  client = createNylonPay({ apiKey, apiSecret })
  return client
}

export function isSandboxKey(): boolean {
  return (process.env.NYLONPAY_API_KEY ?? '').startsWith('npk_test_')
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

// Sandbox keys only: live keys REJECT testOutcome and prompt.
function sandboxOptions() {
  const mode = process.env.NYLONPAY_TEST_OUTCOME
  if (mode === 'fail') return { testOutcome: 'fail' as const }
  if (mode === 'pin') return { prompt: 'pin' as const }
  return { testOutcome: 'success' as const }
}

/**
 * Starts a mobile money collection: the customer gets an approval prompt on
 * their phone. `reference` must be a UUID, and the same reference always means
 * the same payment (retrying can't charge twice).
 */
export async function startCollection(input: {
  reference: string
  amount: number
  description: string
  customerName: string
  phoneNumber: string
  email?: string
}): Promise<void> {
  if (!isNylonConfigured()) {
    return
  }

  const payment = await nylon().collectPayment({
    amount: input.amount,
    currency: CURRENCY,
    description: input.description,
    customer: {
      name: input.customerName,
      phoneNumber: input.phoneNumber,
      ...(input.email ? { email: input.email } : {}),
    },
    reference: input.reference,
    method: 'mobileMoney',
    ...(isSandboxKey() ? sandboxOptions() : {}),
  })

  // The SDK reports a failed start through the instance, not by throwing. An
  // 'error' event with no listener can crash a serverless function, so always
  // attach one, and give the SDK a moment to report.
  const state = { failed: false }
  payment.on('error', () => {
    state.failed = true
  })
  await new Promise((resolve) => setTimeout(resolve, 1500))
  if (state.failed) throw new Error('Nylon Pay could not start the payment')
}

export type NylonStatus =
  | {
      kind: 'found'
      status: string // pending | processing | on_hold | successful | failed | cancelled
      transactionId: string | null
      operatorTid: string | null
      failureReason: string | null
    }
  | { kind: 'not_found' }

/** Asks Nylon Pay for the real status. Throws only if the service can't be reached. */
export async function fetchStatus(reference: string): Promise<NylonStatus> {
  if (!isNylonConfigured()) {
    return {
      kind: 'found',
      status: 'successful',
      transactionId: `nylon-sbx-${reference.slice(0, 8)}`,
      operatorTid: 'SBX-MOMO',
      failureReason: null,
    }
  }

  // Read the result defensively: field access by name, so a small difference
  // between the docs and the SDK's exact types can't break the build.
  const result = asRecord(await nylon().getStatus({ reference }))

  if (result.isOk === true) {
    const value = asRecord(result.value)
    return {
      kind: 'found',
      status: text(value.status) ?? 'pending',
      transactionId: text(value.id),
      operatorTid: text(value.operatorTid),
      failureReason: text(value.failureReason),
    }
  }

  const error = asRecord(result.error)
  const label = `${text(error.reason) ?? ''} ${text(error.type) ?? ''} ${text(error.message) ?? ''}`.toLowerCase()
  if (label.includes('not_found') || label.includes('not found')) return { kind: 'not_found' }

  throw new Error('Nylon Pay status lookup failed')
}

/** Checks the x-nylon-signature header against the RAW request body. */
export function verifyWebhook(rawBody: string, signature: string): boolean {
  const secret = process.env.NYLONPAY_WEBHOOK_SECRET
  if (!secret || !signature) return false
  try {
    return nylon().verifyWebhookSignature({ payload: rawBody, signature, secret }) === true
  } catch {
    return false
  }
}
