'use client'

import { useRouter } from 'next/navigation'
import styles from '@/app/admin/(protected)/admin.module.css'

export default function RangeSelect({ value }: { value: string }) {
  const router = useRouter()
  return (
    <select
      className={styles.rangeSelect}
      value={value}
      onChange={(e) => router.push(`/admin?range=${e.target.value}`)}
    >
      <option value="7d">Last 7 days</option>
      <option value="30d">Last 30 days</option>
      <option value="90d">Last 90 days</option>
    </select>
  )
}
