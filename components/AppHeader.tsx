'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from './header-actions'
import styles from './AppHeader.module.css'

const NAV_LINKS = [
  { href: '/profile', label: 'Profile' },
  { href: '/discover', label: 'Discover' },
]

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function formatRenewDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)
const VerifiedIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
const ProfileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)
const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
)
const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </svg>
)
const HelpIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)
const SignOutIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

export default function AppHeader({
  isSubscribed = false,
  subscriptionEndDate = null,
  displayName = null,
  campus = null,
  verified = false,
  avatarUrl = null,
}: {
  isSubscribed?: boolean
  subscriptionEndDate?: string | null
  displayName?: string | null
  campus?: string | null
  verified?: boolean
  avatarUrl?: string | null
}) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.menuIcon} aria-label="Menu" type="button" onClick={() => setDrawerOpen(true)}>
            <span />
            <span />
            <span />
          </button>
          <div className={styles.wordmark}>SILK ROAD</div>
        </div>

        <nav className={styles.nav}>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.navLink} ${pathname.startsWith(link.href) ? styles.active : ''}`}
            >
              {link.label}
            </Link>
          ))}
          <Link href="/subscribe" className={styles.subscribeBtn}>
            {isSubscribed ? 'Subscribed' : 'Subscribe'}
          </Link>
        </nav>
      </header>

      <div className={`${styles.scrim} ${drawerOpen ? styles.open : ''}`} onClick={() => setDrawerOpen(false)} />

      <div className={`${styles.drawer} ${drawerOpen ? styles.open : ''}`}>
        <div className={styles.drawerTop}>
          <button className={styles.closeBtn} onClick={() => setDrawerOpen(false)} aria-label="Close menu">
            <CloseIcon />
          </button>
        </div>

        <div className={styles.drawerProfile}>
          <div className={styles.drawerAvatar}>
            {avatarUrl && !avatarFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" onError={() => setAvatarFailed(true)} />
            ) : displayName ? (
              getInitials(displayName)
            ) : (
              ''
            )}
          </div>
          <div className={styles.drawerName}>
            {displayName ?? 'Your account'}
            {verified && (
              <span className={styles.verifiedDot}>
                <VerifiedIcon />
              </span>
            )}
          </div>
          {campus && <div className={styles.drawerCampus}>{campus}</div>}

          {isSubscribed ? (
            <div className={`${styles.subCard} ${styles.active}`}>
              <div className={styles.subText}>
                <span className={styles.subLabel}>Subscription</span>
                <span className={`${styles.subValue} ${styles.active}`}>
                  Active{subscriptionEndDate ? ` · renews ${formatRenewDate(subscriptionEndDate)}` : ''}
                </span>
              </div>
            </div>
          ) : (
            <div className={`${styles.subCard} ${styles.inactive}`}>
              <div className={styles.subText}>
                <span className={styles.subLabel}>Subscription</span>
                <span className={`${styles.subValue} ${styles.inactive}`}>Not subscribed</span>
              </div>
              <Link href="/subscribe" className={styles.subCta} onClick={() => setDrawerOpen(false)}>
                Subscribe
              </Link>
            </div>
          )}
        </div>

        <div className={styles.drawerDivider} />

        <nav className={styles.drawerNav}>
          <Link href="/profile" className={styles.drawerItem} onClick={() => setDrawerOpen(false)}>
            <ProfileIcon /> My Profile
          </Link>
          <Link href="/profile/edit" className={styles.drawerItem} onClick={() => setDrawerOpen(false)}>
            <EditIcon /> Edit Profile
          </Link>
          <Link href="/settings" className={styles.drawerItem} onClick={() => setDrawerOpen(false)}>
            <SettingsIcon /> Settings
          </Link>
          {/* Help & Support doesn't have a page yet — shown for layout
              completeness, intentionally not linked until it's built. */}
          <div className={`${styles.drawerItem} ${styles.disabled}`}>
            <HelpIcon /> Help &amp; Support
          </div>
          <div className={styles.drawerDivider} />
          <button
            className={`${styles.drawerItem} ${styles.danger}`}
            type="button"
            onClick={() => {
              setDrawerOpen(false)
              signOut()
            }}
          >
            <SignOutIcon /> Sign out
          </button>
        </nav>

        <div className={styles.drawerFooter}>
          <div className={styles.footerLinks}>
            <Link href="/terms" target="_blank">
              Terms
            </Link>
            <Link href="/privacy" target="_blank">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
