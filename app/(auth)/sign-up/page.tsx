import { isTurnstileConfigured, issueBotChallengeToken } from '@/lib/security/turnstile'
import SignUpForm from './SignUpForm'

export const dynamic = 'force-dynamic'

export default function SignUpPage() {
  const turnstileSiteKey = isTurnstileConfigured()
    ? (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null)
    : null
  const challengeToken = issueBotChallengeToken()

  return <SignUpForm turnstileSiteKey={turnstileSiteKey} challengeToken={challengeToken} />
}
