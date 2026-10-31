import type { ReactNode } from 'react'
import styles from './auth.module.css'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <div className={styles.wordmark}>SILK ROAD</div>
      {children}
    </div>
  )
}
