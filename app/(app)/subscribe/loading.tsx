import styles from './subscribe.module.css'

export default function SubscribeLoading() {
  return (
    <main className={styles.main} aria-busy="true" aria-label="Loading subscription options">
      <div className="sr-skeleton" style={{ width: 180, height: 28, borderRadius: 10 }} />
      <div className="sr-skeleton" style={{ width: '82%', height: 16, marginTop: 10, marginBottom: 24, borderRadius: 8 }} />

      <div className={`${styles.statusCard} ${styles.inactive}`}>
        <div className="sr-skeleton" style={{ width: 90, height: 12, borderRadius: 6 }} />
        <div className="sr-skeleton" style={{ width: 160, height: 20, marginTop: 8, borderRadius: 8 }} />
        <div className="sr-skeleton" style={{ width: '90%', height: 14, marginTop: 10, borderRadius: 6 }} />
      </div>

      <div className={styles.benefitList}>
        <div className="sr-skeleton" style={{ width: '78%', height: 18, borderRadius: 8 }} />
        <div className="sr-skeleton" style={{ width: '86%', height: 18, borderRadius: 8 }} />
        <div className="sr-skeleton" style={{ width: '70%', height: 18, borderRadius: 8 }} />
      </div>

      <div className={styles.planToggle}>
        <div className="sr-skeleton" style={{ flex: 1, height: 92, borderRadius: 14 }} />
        <div className="sr-skeleton" style={{ flex: 1, height: 92, borderRadius: 14 }} />
      </div>

      <div className={styles.spacer} />
      <div className="sr-skeleton" style={{ width: '100%', height: 52, borderRadius: 14 }} />
    </main>
  )
}
