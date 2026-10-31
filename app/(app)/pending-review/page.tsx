import styles from '../../(auth)/auth.module.css'

export default function PendingReviewPage() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 24px' }}>
      <div className={styles.card}>
        <h1>You're in review</h1>
        <p className={styles.subtitle}>
          Your profile and photo are being checked before they go live on Discover. This is
          usually quick — we'll let you know once it's approved.
        </p>
      </div>
    </div>
  )
}
