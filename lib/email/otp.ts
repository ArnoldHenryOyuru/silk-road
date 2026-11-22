import 'server-only'
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendOtpEmail } from './mailer'

const OTP_TTL_MS = 15 * 60_000
const RESEND_COOLDOWN_MS = 60_000
const MAX_ATTEMPTS = 5

interface OtpRecord {
  hash: string
  expiresAt: number
  sentAt: number
  attempts: number
}

const globalForOtp = globalThis as unknown as {
  __silkRoadEmailOtpStore?: Map<string, OtpRecord>
  __silkRoadOtpSecret?: string
  __silkRoadOtpTableWarned?: boolean
}

function getMemoryOtpStore(): Map<string, OtpRecord> {
  if (!globalForOtp.__silkRoadEmailOtpStore) {
    globalForOtp.__silkRoadEmailOtpStore = new Map<string, OtpRecord>()
  }
  return globalForOtp.__silkRoadEmailOtpStore
}

function getOtpSecret(): string {
  const configured =
    process.env.DELETION_LOG_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.TURNSTILE_SECRET_KEY
  if (configured) return configured
  if (!globalForOtp.__silkRoadOtpSecret) {
    globalForOtp.__silkRoadOtpSecret = randomBytes(32).toString('hex')
  }
  return globalForOtp.__silkRoadOtpSecret
}

function hashOtp(userId: string, email: string, code: string): string {
  return createHmac('sha256', getOtpSecret())
    .update(`${userId}:${email.toLowerCase()}:${code}`)
    .digest('hex')
}

async function readOtpRecord(key: string): Promise<{ record: OtpRecord | null; useDb: boolean }> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('email_otps')
      .select('code_hash, sent_at, expires_at, attempts')
      .eq('otp_key', key)
      .maybeSingle()

    if (error) throw error
    if (!data) return { record: null, useDb: true }
    return {
      useDb: true,
      record: {
        hash: String(data.code_hash),
        sentAt: new Date(String(data.sent_at)).getTime(),
        expiresAt: new Date(String(data.expires_at)).getTime(),
        attempts: Number(data.attempts ?? 0),
      },
    }
  } catch (err) {
    if (!globalForOtp.__silkRoadOtpTableWarned) {
      globalForOtp.__silkRoadOtpTableWarned = true
      console.warn('email_otps table unavailable, falling back to in-memory store:', err)
    }
    return { useDb: false, record: getMemoryOtpStore().get(key) ?? null }
  }
}

async function writeOtpRecord(
  key: string,
  userId: string,
  email: string,
  record: OtpRecord,
  useDb: boolean
): Promise<void> {
  if (!useDb) {
    getMemoryOtpStore().set(key, record)
    return
  }

  try {
    const admin = createAdminClient()
    const { data: existing, error: selErr } = await admin
      .from('email_otps')
      .select('id')
      .eq('otp_key', key)
      .maybeSingle()
    if (selErr) throw selErr

    const payload = {
      otp_key: key,
      user_id: userId,
      email,
      code_hash: record.hash,
      sent_at: new Date(record.sentAt).toISOString(),
      expires_at: new Date(record.expiresAt).toISOString(),
      attempts: record.attempts,
    }

    if (existing?.id) {
      const { error: updErr } = await admin.from('email_otps').update(payload).eq('id', existing.id)
      if (updErr) throw updErr
    } else {
      const { error: insErr } = await admin.from('email_otps').insert(payload)
      if (insErr) throw insErr
    }
  } catch {
    getMemoryOtpStore().set(key, record)
  }
}

async function deleteOtpRecord(key: string, useDb: boolean): Promise<void> {
  getMemoryOtpStore().delete(key)
  if (!useDb) return
  try {
    const admin = createAdminClient()
    await admin.from('email_otps').delete().eq('otp_key', key)
  } catch {
    // best effort cleanup
  }
}

export async function issueEmailOtp(userId: string, email: string): Promise<
  | { ok: true; sandboxCode?: string }
  | { ok: false; error: string }
> {
  const normalizedEmail = email.trim().toLowerCase()
  const key = `${userId}:${normalizedEmail}`
  const now = Date.now()
  const { record: existing, useDb } = await readOtpRecord(key)

  if (existing && now - existing.sentAt < RESEND_COOLDOWN_MS) {
    const waitSec = Math.max(1, Math.ceil((RESEND_COOLDOWN_MS - (now - existing.sentAt)) / 1000))
    return { ok: false, error: `Please wait ${waitSec}s before requesting another code.` }
  }

  const code = String(randomInt(100000, 1000000))
  const nextRecord: OtpRecord = {
    hash: hashOtp(userId, normalizedEmail, code),
    expiresAt: now + OTP_TTL_MS,
    sentAt: now,
    attempts: 0,
  }
  await writeOtpRecord(key, userId, normalizedEmail, nextRecord, useDb)

  const mailRes = await sendOtpEmail(normalizedEmail, code)
  if (mailRes.skipped) {
    // Sandbox fallback when Resend secrets are unset
    return { ok: true, sandboxCode: code }
  }
  if (!mailRes.sent) {
    return { ok: false, error: 'Could not send the verification email. Please try again.' }
  }

  return { ok: true }
}

export async function verifyEmailOtpCode(
  userId: string,
  email: string,
  submittedCode: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cleanCode = submittedCode.replace(/\s+/g, '')
  if (!/^\d{6}$/.test(cleanCode)) {
    return { ok: false, error: 'Enter the 6-digit verification code.' }
  }

  const normalizedEmail = email.trim().toLowerCase()
  const key = `${userId}:${normalizedEmail}`
  const { record, useDb } = await readOtpRecord(key)

  if (!record) {
    return { ok: false, error: 'Request a verification code first.' }
  }

  if (Date.now() > record.expiresAt) {
    await deleteOtpRecord(key, useDb)
    return { ok: false, error: 'That code has expired. Request a new code.' }
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await deleteOtpRecord(key, useDb)
    return { ok: false, error: 'Too many incorrect attempts. Request a new code.' }
  }

  const candidateHash = hashOtp(userId, normalizedEmail, cleanCode)
  const actualBuf = Buffer.from(candidateHash, 'utf8')
  const expectedBuf = Buffer.from(record.hash, 'utf8')

  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) {
    const updated: OtpRecord = { ...record, attempts: record.attempts + 1 }
    await writeOtpRecord(key, userId, normalizedEmail, updated, useDb)
    return { ok: false, error: 'Incorrect verification code. Please check and try again.' }
  }

  await deleteOtpRecord(key, useDb)
  return { ok: true }
}
