import 'server-only'
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

const globalForBotSecret = globalThis as unknown as {
  __silkRoadBotSecret?: string
}

function getSigningSecret(): string {
  const configured =
    process.env.TURNSTILE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.DELETION_LOG_SECRET
  if (configured) return configured

  if (!globalForBotSecret.__silkRoadBotSecret) {
    globalForBotSecret.__silkRoadBotSecret = randomBytes(32).toString('hex')
  }
  return globalForBotSecret.__silkRoadBotSecret
}

export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY)
}

function signPayload(payload: string): string {
  return createHmac('sha256', getSigningSecret()).update(payload).digest('hex')
}

export function issueBotChallengeToken(): string {
  const issuedAt = Date.now()
  const nonce = randomBytes(8).toString('hex')
  const payload = `${issuedAt}.${nonce}`
  const sig = signPayload(payload)
  return `${payload}.${sig}`
}

export async function verifySignUpHumanCheck({
  turnstileToken,
  challengeToken,
  honeypot,
  remoteIp,
}: {
  turnstileToken: string
  challengeToken: string
  honeypot: string
  remoteIp: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (honeypot.trim() !== '') {
    return { ok: false, error: 'Could not create your account. Please try again.' }
  }

  if (isTurnstileConfigured()) {
    if (!turnstileToken.trim()) {
      return { ok: false, error: 'Please complete the security check before continuing.' }
    }

    try {
      const body = new URLSearchParams()
      body.set('secret', process.env.TURNSTILE_SECRET_KEY!)
      body.set('response', turnstileToken.trim())
      if (remoteIp) body.set('remoteip', remoteIp)

      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })

      if (!res.ok) {
        return { ok: false, error: 'Security check could not be verified. Please try again.' }
      }

      const data = (await res.json()) as { success?: boolean }
      if (!data.success) {
        return { ok: false, error: 'Security check failed. Please try again.' }
      }
      return { ok: true }
    } catch {
      return { ok: false, error: 'Security check timed out. Please try again.' }
    }
  }

  // Safe signed-challenge fallback when Turnstile keys are unset:
  // validates server-issued HMAC signature, expiry (30m), and minimum dwell time (1200ms).
  const parts = challengeToken.split('.')
  if (parts.length !== 3) {
    return { ok: false, error: 'Please refresh the page and try again.' }
  }

  const [issuedRaw, nonce, sig] = parts
  const issuedAt = Number(issuedRaw)
  if (!Number.isFinite(issuedAt) || !nonce || !sig) {
    return { ok: false, error: 'Please refresh the page and try again.' }
  }

  const expectedSig = signPayload(`${issuedRaw}.${nonce}`)
  const actualBuf = Buffer.from(sig, 'utf8')
  const expectedBuf = Buffer.from(expectedSig, 'utf8')
  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) {
    return { ok: false, error: 'Security check could not be verified. Please refresh and try again.' }
  }

  const ageMs = Date.now() - issuedAt
  if (ageMs > 30 * 60_000) {
    return { ok: false, error: 'Your sign-up form timed out. Refresh the page and try again.' }
  }
  if (ageMs < 1200) {
    return { ok: false, error: 'Please take a moment to review the form and submit again.' }
  }

  return { ok: true }
}
