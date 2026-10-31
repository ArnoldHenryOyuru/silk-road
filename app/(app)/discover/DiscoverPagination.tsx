import Link from 'next/link'
import styles from './discover.module.css'

function href(page: number) {
  return page === 1 ? '/discover' : `/discover?page=${page}`
}

/**
 * Previous / 1 2 3 … 9 / Next. Every page is a real link (/discover?page=3), so
 * pages can be bookmarked and shared, and the back button works.
 */
export default function DiscoverPagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null

  // Always show first, last and the current page with its neighbours.
  const shown = [...new Set([1, totalPages, page - 1, page, page + 1])]
    .filter((n) => n >= 1 && n <= totalPages)
    .sort((a, b) => a - b)

  const items: Array<number | string> = []
  shown.forEach((n, i) => {
    if (i > 0 && n - shown[i - 1] > 1) items.push(`gap-${n}`)
    items.push(n)
  })

  return (
    <nav className={styles.pagination} aria-label="Discover pages">
      {page > 1 ? (
        <Link className={styles.pageLink} href={href(page - 1)} aria-label="Previous page">
          ‹ Prev
        </Link>
      ) : (
        <span className={styles.pageLink} aria-disabled="true">
          ‹ Prev
        </span>
      )}

      {items.map((item) =>
        typeof item === 'string' ? (
          <span key={item} className={styles.pageGap} aria-hidden="true">
            …
          </span>
        ) : (
          <Link
            key={item}
            className={styles.pageLink}
            href={href(item)}
            aria-current={item === page ? 'page' : undefined}
            aria-label={`Page ${item}`}
          >
            {item}
          </Link>
        )
      )}

      {page < totalPages ? (
        <Link className={styles.pageLink} href={href(page + 1)} aria-label="Next page">
          Next ›
        </Link>
      ) : (
        <span className={styles.pageLink} aria-disabled="true">
          Next ›
        </span>
      )}
    </nav>
  )
}
