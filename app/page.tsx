import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getTeaser, TEASER_MIN } from '@/lib/teaser'
import { safeNext } from '@/lib/members-only'
import { PLANS, CURRENCY, formatUgx } from '@/lib/payments/plans'
import styles from './home.module.css'

export const metadata = {
  title: 'Silk Road: meet students on your campus',
  description: 'Browse reviewed profiles from Makerere, MUBS, Kyambogo and more, and say hello on WhatsApp.',
}

// Read from lib/payments/plans.ts, the single source of truth, so the homepage
// can never show a different price or daily limit from the real checkout.
const PLAN_CARDS = Object.values(PLANS).map((plan) => ({
  name: plan.label,
  price: `${CURRENCY} ${formatUgx(plan.amount)}`,
  perDay: plan.dailyContacts,
  period: `${plan.days} days`,
}))

const STEPS = [
  {
    title: 'Create your profile',
    text: 'Add a few photos and a short bio. Every profile and photo is checked by a person, usually within a few hours.',
  },
  {
    title: 'Browse Discover',
    text: 'Look through students from your campus and others. Like profiles you enjoy, and choose whether you are listed or discreet.',
  },
  {
    title: 'Subscribe and say hello',
    text: 'Subscribers open a WhatsApp chat with the people they like, within a daily limit.',
  },
]

const TRUST = [
  { title: 'Reviewed before shown', text: 'New profiles, photos and bio changes are reviewed before they appear to others.' },
  { title: '18 and over only', text: 'Everyone confirms a date of birth, and under-18s cannot join.' },
  { title: 'Report and block', text: 'You can report or block anyone at any time, and blocked people can never contact you.' },
  { title: 'Your number stays private', text: 'Your WhatsApp number is never shown on your profile. It is only used when a subscriber contacts you.' },
  { title: 'You are in control', text: 'Go discreet to browse without being listed, deactivate whenever you like, or delete your account for free.' },
]

function PinIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>
}) {
  const params = await searchParams
  const next = safeNext(params.next, '')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Signed-in members never need this page.
  if (user) redirect(next || '/discover')

  const teaser = await getTeaser()
  const showTeaser = teaser.length >= TEASER_MIN

  const signInHref = next ? `/sign-in?next=${encodeURIComponent(next)}` : '/sign-in'

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <span className={styles.logo}>Silk Road</span>
        <Link className={styles.signInLink} href={signInHref}>
          Sign in
        </Link>
      </header>

      <section className={styles.hero}>
        <h1>Meet people on your campus, on your terms.</h1>
        <p>
          Browse reviewed profiles from Makerere, MUBS, Kyambogo and more. Subscribe when you are ready to say hello on
          WhatsApp.
        </p>
        <div className={styles.ctaRow}>
          <Link className={styles.primaryBtn} href="/sign-up">
            Join Silk Road
          </Link>
          <Link className={styles.secondaryBtn} href={signInHref}>
            I already have an account
          </Link>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>How it works</h2>
        <p className={styles.sectionSub}>Three steps from sign-up to a conversation.</p>
        <div className={styles.steps}>
          {STEPS.map((step, i) => (
            <div className={styles.step} key={step.title}>
              <div className={styles.stepNum}>{i + 1}</div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{showTeaser ? 'A look inside' : 'Members near you'}</h2>
        {showTeaser ? (
          <>
            <p className={styles.sectionSub}>Featured profiles you can meet today.</p>
            <div className={styles.teaserGrid}>
              {teaser.map((card, i) => (
                <div className={styles.teaserCard} key={`${card.firstName}-${i}`}>
                  <div
                    className={styles.teaserPhoto}
                    style={{ backgroundImage: `url(${card.photoUrl})` }}
                    role="img"
                    aria-label={`${card.firstName}, ${card.age}`}
                  />
                  <div className={styles.teaserBody}>
                    <div className={styles.teaserName}>
                      {card.firstName}, {card.age}
                    </div>
                    <div className={styles.teaserMeta}>
                      <PinIcon /> {card.campus}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className={styles.teaserNote}>Join to see everyone. Members can switch this preview off at any time.</p>
          </>
        ) : (
          <div className={styles.teaserEmpty}>
            <p>New members are joining every day. Create your profile to see who is on Silk Road.</p>
            <Link className={styles.primaryBtn} href="/sign-up">
              Join Silk Road
            </Link>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Plans</h2>
        <p className={styles.sectionSub}>
          Browsing is free. A plan lets you contact people on WhatsApp, up to a daily limit that resets at midnight
          (Kampala time).
        </p>
        <div className={styles.plans}>
          {PLAN_CARDS.map((plan) => (
            <div className={styles.plan} key={plan.name}>
              <div className={styles.planName}>{plan.name}</div>
              <div className={styles.planPrice}>{plan.price}</div>
              <div className={styles.planLine}>{plan.period}</div>
              <div className={styles.planLine}>Up to {plan.perDay} new people per day</div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Trust and safety</h2>
        <p className={styles.sectionSub}>What we do to keep Silk Road respectful.</p>
        <ul className={styles.trustList}>
          {TRUST.map((item) => (
            <li className={styles.trustItem} key={item.title}>
              <div>
                <div className={styles.trustTitle}>{item.title}</div>
                <div className={styles.trustText}>{item.text}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.finalCta}>
        <h2>Ready when you are.</h2>
        <p>It takes a few minutes to create your profile.</p>
        <Link className={styles.primaryBtn} href="/sign-up">
          Join Silk Road
        </Link>
      </section>

      <footer className={styles.footer}>
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
      </footer>
    </main>
  )
}
