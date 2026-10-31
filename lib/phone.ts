/**
 * Normalizes a Ugandan mobile number into plain international digits
 * (e.g. "2567xxxxxxxx"), the format wa.me links need — no +, no leading 0.
 * Accepts input as 07xxxxxxxx, +2567xxxxxxxx, or 2567xxxxxxxx.
 * Returns null if it doesn't look like a valid Ugandan mobile number.
 */
export function normalizeUgandaPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, '')

  let normalized: string
  if (digits.startsWith('256') && digits.length === 12) {
    normalized = digits
  } else if (digits.startsWith('0') && digits.length === 10) {
    normalized = '256' + digits.slice(1)
  } else if (digits.length === 9) {
    normalized = '256' + digits
  } else {
    return null
  }

  // All current Ugandan mobile ranges (MTN/Airtel/UTL/Lycamobile) start 07x,
  // i.e. 2567x once normalized.
  if (!/^2567\d{8}$/.test(normalized)) return null

  return normalized
}
