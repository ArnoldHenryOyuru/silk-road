import styles from '../legal.module.css'

export const metadata = {
  title: 'Terms of Service — Silk Road',
}

export default function TermsPage() {
  return (
    <div className={styles.content}>
      <h1>Terms of Service</h1>
      <p className={styles.updated}>Last updated: [date]</p>

      <h2>1. Who can use Silk Road</h2>
      <p>
        You must be at least 18 years old to create an account. By signing up, you confirm that you meet this
        requirement and that the information you provide — your name, age, campus, and contact details — is
        accurate.
      </p>

      <h2>2. Account approval and verification</h2>
      <p>
        New profiles and photos go through a review process before they&apos;re visible to other members. We may
        ask for a verification selfie to confirm your photos are genuinely you. We can reject a profile or
        photo, or ask you to resubmit, at our discretion.
      </p>

      <h2>3. Subscriptions and payment</h2>
      <p>
        Contacting other members requires an active subscription, paid via Mobile Money (MTN or Airtel).
        Subscriptions run for a fixed period (weekly or monthly) and do not renew automatically — you choose
        when to subscribe again. Fees already paid are generally non-refundable, except where required by law.
      </p>

      <h2>4. Conduct</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Impersonate someone else, or use photos that aren&apos;t genuinely your own</li>
        <li>Harass, threaten, or abuse other members</li>
        <li>Use Silk Road if you&apos;re under 18</li>
        <li>Attempt to circumvent our moderation, verification, or payment systems</li>
      </ul>
      <p>
        Members can report or block each other. We review reports and may suspend or permanently ban accounts
        that violate these terms, at our discretion.
      </p>

      <h2>5. Your content</h2>
      <p>
        You keep ownership of the photos, bio, and other content you post. By posting it, you give Silk Road
        permission to display it to other members as part of the normal operation of the app.
      </p>

      <h2>6. Deactivation and deletion</h2>
      <p>
        You can deactivate your account at any time — this hides your profile and is reversible by signing
        back in. You can also request full account deletion, which is permanent.
      </p>

      <h2>7. No guarantee of outcomes</h2>
      <p>
        Silk Road helps you discover and contact other members — it doesn&apos;t guarantee matches, dates, or any
        particular outcome, and we aren&apos;t responsible for what happens in conversations or meetings that
        result from using the app.
      </p>

      <h2>8. Changes to these terms</h2>
      <p>
        We may update these terms from time to time. Continued use of Silk Road after a change means you
        accept the updated terms.
      </p>

      <h2>9. Contact</h2>
      <p>Questions about these terms can be sent to [support email].</p>
    </div>
  )
}
