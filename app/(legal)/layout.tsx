import type { ReactNode } from 'react'
import Link from 'next/link'
import styles from './legal.module.css'

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" className={styles.wordmark}>
          SILK ROAD
        </Link>
      </header>
      {children}
    </div>
  )
}
