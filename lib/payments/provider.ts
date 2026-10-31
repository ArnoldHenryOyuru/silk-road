/**
 * Which gateway new checkouts use. Deliberately NOT 'server-only': the Subscribe
 * screens read it too, to decide whether to ask for a mobile money number.
 *
 * Set NEXT_PUBLIC_PAYMENT_PROVIDER=nylon to switch. Anything else (or unset)
 * means Pesapal. Next.js bakes NEXT_PUBLIC_ values in at build time, so change it
 * in Vercel and REDEPLOY. Payments already started with the other gateway still
 * finish through their own IPN or webhook route.
 */
export type PaymentProvider = 'pesapal' | 'nylon'

export const paymentProvider: PaymentProvider =
  process.env.NEXT_PUBLIC_PAYMENT_PROVIDER === 'nylon' ? 'nylon' : 'pesapal'
