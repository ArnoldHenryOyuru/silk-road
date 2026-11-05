'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from '@/app/admin/(protected)/admin.module.css'

const TABS = [
  { label: 'Overview', href: '/admin' },
  { label: 'Profiles', href: '/admin/profiles', key: 'profiles' },
  { label: 'Photos', href: '/admin/photos', key: 'photos' },
  { label: 'Bio edits', href: '/admin/edits', key: 'edits' },
  { label: 'Reports', href: '/admin/reports', key: 'reports' },
  { label: 'Members', href: '/admin/members' },
  { label: 'Payments', href: '/admin/payments' },
] as const

export default function AdminTopNav({ counts }: { counts: Record<string, number> }) {
  const pathname = usePathname()
  return (
    <nav className={styles.tabs}>
      {TABS.map((t) => {
        const active = t.href === '/admin' ? pathname === '/admin' : pathname.startsWith(t.href)
        const n = 'key' in t ? counts[t.key] : 0
        return (
          <Link key={t.href} href={t.href} className={`${styles.tab} ${active ? styles.tabActive : ''}`}>
            {t.label}
            {n > 0 && <span className={styles.tabBadge}>{n}</span>}
          </Link>
        )
      })}
    </nav>
  )
}
