import styles from './settings.module.css'

export default function SettingsLoading() {
  return (
    <main className={styles.page} aria-busy="true" aria-label="Loading settings">
      <div className="sr-skeleton" style={{ width: 120, height: 28, marginBottom: 24, borderRadius: 8 }} />

      <section className={styles.section}>
        <div className="sr-skeleton" style={{ width: 96, height: 18, marginBottom: 12, borderRadius: 6 }} />
        <div className="sr-skeleton" style={{ width: 220, height: 16, borderRadius: 6 }} />
      </section>

      <section className={styles.section}>
        <div className="sr-skeleton" style={{ width: 140, height: 18, marginBottom: 10, borderRadius: 6 }} />
        <div className="sr-skeleton" style={{ width: '90%', height: 15, marginBottom: 14, borderRadius: 6 }} />
        <div className="sr-skeleton" style={{ width: 150, height: 40, borderRadius: 8 }} />
      </section>

      <section className={styles.section}>
        <div className="sr-skeleton" style={{ width: 150, height: 18, marginBottom: 10, borderRadius: 6 }} />
        <div className="sr-skeleton" style={{ width: '84%', height: 15, borderRadius: 6 }} />
      </section>
    </main>
  )
}
