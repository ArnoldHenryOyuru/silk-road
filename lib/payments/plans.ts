/**
 * Single source of truth for plan prices and perks. The server reads the price
 * from here, never from the browser. Prices are whole UGX (UGX has no decimals).
 *
 * `days` must match the day counts inside complete_payment() in
 * sql/payments-migration.sql.
 *
 * `dailyContacts` is how many DIFFERENT people a subscriber may unlock per day
 * (the day resets at midnight Kampala time). Reopening someone you already
 * unlocked that day doesn't use another one.
 */
export const CURRENCY = 'UGX'

export const PLANS = {
  weekly: { label: 'Weekly', amount: 10000, days: 7, dailyContacts: 2 },
  monthly: { label: 'Monthly', amount: 25000, days: 30, dailyContacts: 5 },
} as const

export type PlanId = keyof typeof PLANS

export function isPlanId(value: unknown): value is PlanId {
  return value === 'weekly' || value === 'monthly'
}

export function formatUgx(amount: number) {
  return amount.toLocaleString('en-US')
}
