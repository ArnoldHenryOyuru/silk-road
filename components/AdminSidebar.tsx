'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactElement } from 'react'
import styles from './AdminSidebar.module.css'

const LINKS = [
  { href: '/admin', label: 'Overview', key: null as null | 'profiles' | 'photos' | 'edits' | 'reports' },
  { href: '/admin/profiles', label: 'Pending Profiles', key: 'profiles' as const },
  { href: '/admin/photos', label: 'Pending Photos', key: 'photos' as const },
  { href: '/admin/edits', label: 'Bio Edits', key: 'edits' as const },
  { href: '/admin/reports', label: 'Reports', key: 'reports' as const },
]

const ICONS: Record<string, ReactElement> = {
  '/admin': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </svg>
  ),
  '/admin/profiles': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  '/admin/photos': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  ),
  '/admin/edits': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  '/admin/reports': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
}

export default function AdminSidebar({
  counts,
}: {
  counts: { profiles: number; photos: number; edits: number; reports: number }
}) {
  const pathname = usePathname()

  return (
    <aside className={styles.sidebar}>
      <div className={styles.wordmark}>
        SILK ROAD <span>ADMIN</span>
      </div>

      {LINKS.map((link) => {
        const count = link.key ? counts[link.key] : null
        const isActive = link.href === '/admin' ? pathname === '/admin' : pathname.startsWith(link.href)
        return (
          <Link key={link.href} href={link.href} className={`${styles.link} ${isActive ? styles.active : ''}`}>
            <span className={styles.linkLeft}>
              {ICONS[link.href]}
              {link.label}
            </span>
            {count !== null && <span className={`${styles.badge} ${count === 0 ? styles.zero : ''}`}>{count}</span>}
          </Link>
        )
      })}
    </aside>
  )
}
