import styles from './discover.module.css'

const CARDS = Array.from({ length: 8 })

export default function DiscoverLoading() {
  return (
    <main className={styles.discoverMain} aria-busy="true" aria-label="Loading Discover feed">
      <div className={styles.discoverHero}>
        <div className={styles.discoverHeroRow}>
          <div>
            <div className="sr-skeleton" style={{ width: 148, height: 34, borderRadius: 10 }} />
            <div className="sr-skeleton" style={{ width: 196, height: 16, marginTop: 12, borderRadius: 8 }} />
          </div>
          <div className="sr-skeleton" style={{ width: 44, height: 44, borderRadius: '50%' }} />
        </div>
      </div>

      <div className={styles.grid}>
        {CARDS.map((_, i) => (
          <div className={styles.card} key={i}>
            <div className={styles.cardPhoto}>
              <div className="sr-skeleton" style={{ width: '100%', height: '100%', borderRadius: 0 }} />
            </div>
            <div className={styles.cardBody}>
              <div className="sr-skeleton" style={{ width: '72%', height: 14, borderRadius: 6 }} />
              <div className="sr-skeleton" style={{ width: '52%', height: 12, marginTop: 8, borderRadius: 6 }} />
              <div className="sr-skeleton" style={{ width: '44%', height: 12, marginTop: 6, borderRadius: 6 }} />
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
