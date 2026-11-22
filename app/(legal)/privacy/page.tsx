import styles from '../legal.module.css'

export const metadata = {
  title: 'Privacy Policy — Silk Road',
}

export default function PrivacyPage() {
  return (
    <div className={styles.content}>
      <h1>Privacy Policy</h1>
      <p className={styles.updated}>Last updated: [date]</p>

      <h2>1. What we collect</h2>
      <p>When you use Silk Road, we collect:</p>
      <ul>
        <li>Your email address and password (used to sign you in)</li>
        <li>Your name, age, campus, bio, interests, and preferences</li>
        <li>Your WhatsApp number — used only to let subscribed members contact you</li>
        <li>Photos you upload, and optionally a verification selfie used to confirm they&apos;re genuinely you</li>
        <li>Basic activity like likes, reports, and blocks, to keep the app safe and working</li>
      </ul>

      <h2>2. How we use it</h2>
      <p>We use this information to run the app: showing your profile to other members once it&apos;s approved, letting subscribed members contact you, reviewing reports, and processing subscription payments.</p>

      <h2>3. Your phone number specifically</h2>
      <p>
        Your number is never shown on your public profile. It&apos;s only revealed to another member when they
        have an active subscription <em>and</em> actively choose to contact you — and every time that happens,
        we log it internally for safety and accountability.
      </p>

      <h2>4. Who we share data with</h2>
      <p>We share the minimum necessary with a small number of service providers that help run Silk Road:</p>
      <ul>
        <li>Our database and file storage provider, which hosts your account and photos securely</li>
        <li>Our email provider, used only to send account verification codes and password resets</li>
        <li>Our Mobile Money payment partner, used only to process subscription payments</li>
      </ul>
      <p>We don&apos;t sell your data to advertisers or other third parties.</p>

      <h2>5. Photo storage</h2>
      <p>
        Your photos are stored privately, not on the open internet — they&apos;re only ever shown to other members
        through temporary, expiring links generated when your profile is viewed.
      </p>

      <h2>6. How long we keep your data</h2>
      <p>
        If you deactivate your account, your data is kept but hidden, in case you come back. If you request
        full deletion, your profile, photos, and personal information are permanently removed. Some records —
        like safety reports or payment history — may be kept longer where we&apos;re required to for legal or
        fraud-prevention reasons.
      </p>

      <h2>7. Your rights</h2>
      <p>You can ask to see what data we hold about you, correct it, or request deletion, at any time by contacting us.</p>

      <h2>8. Age requirement</h2>
      <p>Silk Road is for people 18 and older. We don&apos;t knowingly collect data from anyone under 18.</p>

      <h2>9. Changes to this policy</h2>
      <p>We may update this policy as the app changes. We&apos;ll update the date at the top when we do.</p>

      <h2>10. Contact</h2>
      <p>Questions about your data can be sent to [support email].</p>
    </div>
  )
}
