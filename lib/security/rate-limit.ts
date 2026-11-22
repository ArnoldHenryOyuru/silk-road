import 'server-only'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

interface RateBucket {
  hits: number[]
}

const globalForRateLimit = globalThis as unknown as {
  __silkRoadRateLimits?: Map<string, RateBucket>
  __silkRoadRateLimitTableWarned?: boolean
}

function getMemoryStore(): Map<string, RateBucket> {
  if (!globalForRateLimit.__silkRoadRateLimits) {
    globalForRateLimit.__silkRoadRateLimits = new Map<string, RateBucket>()
  }
  return globalForRateLimit.__silkRoadRateLimits
}

function checkRateLimitInMemory(
  key: string,
  limit: number,
  windowMs: number
): { ok: true; remaining: number } | { ok: false; retryAfterSec: number } {
  const store = getMemoryStore()
  const now = Date.now()
  const cutoff = now - windowMs

  const bucket = store.get(key) ?? { hits: [] }
  const recent = bucket.hits.filter((ts) => ts > cutoff)

  if (recent.length >= limit) {
    const oldest = recent[0] ?? now
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
    bucket.hits = recent
    store.set(key, bucket)
    return { ok: false, retryAfterSec }
  }

  recent.push(now)
  bucket.hits = recent
  store.set(key, bucket)

  if (store.size > 5000) {
    for (const [k, b] of store.entries()) {
      if (b.hits.every((ts) => ts <= cutoff)) {
        store.delete(k)
      }
    }
  }

  return { ok: true, remaining: Math.max(0, limit - recent.length) }
}

export async function getClientIp(): Promise<string> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return h.get('x-real-ip')?.trim() || '127.0.0.1'
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ ok: true; remaining: number } | { ok: false; retryAfterSec: number }> {
  const now = Date.now()
  const cutoffIso = new Date(now - windowMs).toISOString()

  try {
    const admin = createAdminClient()

    // Prune expired hits for this key in the background/best-effort
    await admin.from('rate_limit_hits').delete().eq('bucket_key', key).lt('created_at', cutoffIso)

    const { data, error } = await admin
      .from('rate_limit_hits')
      .select('created_at')
      .eq('bucket_key', key)
      .gt('created_at', cutoffIso)
      .order('created_at', { ascending: true })
      .limit(limit + 1)

    if (error) {
      throw error
    }

    const recent = (data ?? []) as Array<{ created_at: string }>
    if (recent.length >= limit) {
      const oldestMs = recent[0]?.created_at ? new Date(recent[0].created_at).getTime() : now
      const retryAfterSec = Math.max(1, Math.ceil((oldestMs + windowMs - now) / 1000))
      return { ok: false, retryAfterSec }
    }

    const { error: insertError } = await admin.from('rate_limit_hits').insert({
      bucket_key: key,
      created_at: new Date(now).toISOString(),
    })
    if (insertError) {
      throw insertError
    }

    return { ok: true, remaining: Math.max(0, limit - (recent.length + 1)) }
  } catch (err) {
    if (!globalForRateLimit.__silkRoadRateLimitTableWarned) {
      globalForRateLimit.__silkRoadRateLimitTableWarned = true
      console.warn('rate_limit_hits table unavailable, falling back to in-memory bucket:', err)
    }
    return checkRateLimitInMemory(key, limit, windowMs)
  }
}
