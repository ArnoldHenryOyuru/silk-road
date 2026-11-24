import styles from './profile-view.module.css'

export default function ProfileLoading() {
  return (
    <main className={styles.main} aria-busy="true" aria-label="Loading profile">
      <div className="sr-skeleton" style={{ width: 128, height: 18, marginBottom: 20, borderRadius: 8 }} />

      <div className={styles.gallery}>
        <div className="sr-skeleton" style={{ width: '100%', height: '100%', borderRadius: 0 }} />
      </div>

      <div className={styles.identityRow}>
        <div className="sr-skeleton" style={{ width: 190, height: 28, borderRadius: 10 }} />
        <div className={styles.iconActions}>
          <div className="sr-skeleton" style={{ width: 44, height: 44, borderRadius: '50%' }} />
          <div className="sr-skeleton" style={{ width: 44, height: 44, borderRadius: '50%' }} />
        </div>
      </div>

      <div className="sr-skeleton" style={{ width: 140, height: 16, marginTop: 10, borderRadius: 6 }} />

      <div className={styles.tagRow} style={{ marginTop: 18 }}>
        <div className="sr-skeleton" style={{ width: 112, height: 28, borderRadius: 999 }} />
        <div className="sr-skeleton" style={{ width: 88, height: 28, borderRadius: 999 }} />
        <div className="sr-skeleton" style={{ width: 96, height: 28, borderRadius: 999 }} />
      </div>

      <div style={{ marginTop: 28 }}>
        <div className="sr-skeleton" style={{ width: 72, height: 14, borderRadius: 6 }} />
        <div className="sr-skeleton" style={{ width: '100%', height: 15, marginTop: 12, borderRadius: 6 }} />
        <div className="sr-skeleton" style={{ width: '88%', height: 15, marginTop: 8, borderRadius: 6 }} />
        <div className="sr-skeleton" style={{ width: '64%', height: 15, marginTop: 8, borderRadius: 6 }} />
      </div>

      <div className={styles.contactCard}>
        <div className="sr-skeleton" style={{ width: '100%', height: 50, borderRadius: 12 }} />
      </div>
    </main>
  )
}
