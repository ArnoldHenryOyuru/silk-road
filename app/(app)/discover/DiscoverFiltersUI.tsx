'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SlidersHorizontal, X } from 'lucide-react'
import {
  buildDiscoverHref,
  countActiveDiscoverFilters,
  DISCOVER_CAMPUS_OPTIONS,
  DISCOVER_LOOKING_FOR_OPTIONS,
  EMPTY_DISCOVER_FILTERS,
  type DiscoverFilters,
} from '@/lib/discover-filters'
import styles from './discover.module.css'

function toggleInList(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((v) => v !== item) : [...list, item]
}

function parseOptionalAge(raw: string): number | null {
  const clean = raw.trim()
  if (!clean) return null
  const num = Number.parseInt(clean, 10)
  if (!Number.isFinite(num)) return null
  return Math.min(99, Math.max(18, num))
}

export function DiscoverFilterButton({ initialFilters }: { initialFilters: DiscoverFilters }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const [campuses, setCampuses] = useState<string[]>(initialFilters.campuses)
  const [lookingFor, setLookingFor] = useState<string[]>(initialFilters.lookingFor)
  const [minAgeText, setMinAgeText] = useState<string>(
    initialFilters.minAge !== null ? String(initialFilters.minAge) : ''
  )
  const [maxAgeText, setMaxAgeText] = useState<string>(
    initialFilters.maxAge !== null ? String(initialFilters.maxAge) : ''
  )
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(initialFilters.verifiedOnly)

  const activeCount = countActiveDiscoverFilters(initialFilters)

  function openDialog() {
    setCampuses(initialFilters.campuses)
    setLookingFor(initialFilters.lookingFor)
    setMinAgeText(initialFilters.minAge !== null ? String(initialFilters.minAge) : '')
    setMaxAgeText(initialFilters.maxAge !== null ? String(initialFilters.maxAge) : '')
    setVerifiedOnly(initialFilters.verifiedOnly)
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const stagedDirty =
    campuses.length > 0 ||
    lookingFor.length > 0 ||
    minAgeText.trim() !== '' ||
    maxAgeText.trim() !== '' ||
    verifiedOnly

  function handleApply() {
    let minAge = parseOptionalAge(minAgeText)
    let maxAge = parseOptionalAge(maxAgeText)
    if (minAge !== null && maxAge !== null && minAge > maxAge) {
      ;[minAge, maxAge] = [maxAge, minAge]
    }
    const next: DiscoverFilters = {
      campuses,
      lookingFor,
      minAge,
      maxAge,
      verifiedOnly,
    }
    setOpen(false)
    router.push(buildDiscoverHref(next, 1))
  }

  function handleReset() {
    setCampuses([])
    setLookingFor([])
    setMinAgeText('')
    setMaxAgeText('')
    setVerifiedOnly(false)
    if (activeCount > 0) {
      setOpen(false)
      router.push('/discover')
    }
  }

  return (
    <>
      <button
        className={styles.filterBtn}
        aria-label={activeCount > 0 ? `Filters (${activeCount} active)` : 'Filters'}
        aria-expanded={open}
        aria-haspopup="dialog"
        type="button"
        onClick={openDialog}
      >
        <SlidersHorizontal size={18} strokeWidth={2.2} aria-hidden="true" />
        {activeCount > 0 && (
          <span className={styles.filterCountBadge} aria-hidden="true">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={styles.filterBackdrop}
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className={styles.filterDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="discover-filters-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.sheetHandle} aria-hidden="true" />

            <div className={styles.filterDialogHeader}>
              <h2 id="discover-filters-title" className={styles.filterDialogTitle}>
                Filter profiles
              </h2>
              <button
                type="button"
                className={styles.filterCloseBtn}
                aria-label="Close filters"
                onClick={() => setOpen(false)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className={styles.filterDialogBody}>
              <div>
                <span className={styles.filterGroupLabel}>Campus</span>
                <div className={styles.filterOptionGrid}>
                  {DISCOVER_CAMPUS_OPTIONS.map((opt) => {
                    const selected = campuses.includes(opt.value)
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        className={styles.filterOptionBtn}
                        aria-pressed={selected}
                        onClick={() => setCampuses((prev) => toggleInList(prev, opt.value))}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <span className={styles.filterGroupLabel}>Looking for</span>
                <div className={styles.filterOptionGrid}>
                  {DISCOVER_LOOKING_FOR_OPTIONS.map((opt) => {
                    const selected = lookingFor.includes(opt.value)
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        className={styles.filterOptionBtn}
                        aria-pressed={selected}
                        onClick={() => setLookingFor((prev) => toggleInList(prev, opt.value))}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <span className={styles.filterGroupLabel}>Age range</span>
                <div className={styles.ageRow}>
                  <label className={styles.ageField}>
                    <span className={styles.ageSubLabel}>Min age</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={18}
                      max={99}
                      placeholder="18"
                      value={minAgeText}
                      onChange={(e) => setMinAgeText(e.target.value)}
                      className={styles.ageInput}
                    />
                  </label>
                  <span className={styles.ageSeparator} aria-hidden="true">
                    to
                  </span>
                  <label className={styles.ageField}>
                    <span className={styles.ageSubLabel}>Max age</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={18}
                      max={99}
                      placeholder="35"
                      value={maxAgeText}
                      onChange={(e) => setMaxAgeText(e.target.value)}
                      className={styles.ageInput}
                    />
                  </label>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={verifiedOnly}
                  className={styles.verifiedSwitchRow}
                  onClick={() => setVerifiedOnly((v) => !v)}
                >
                  <div>
                    <div className={styles.verifiedSwitchTitle}>Verified members only</div>
                    <div className={styles.verifiedSwitchSub}>
                      Show profiles confirmed with a verification selfie
                    </div>
                  </div>
                  <span className={styles.switchTrack} aria-hidden="true">
                    <span className={styles.switchThumb} />
                  </span>
                </button>
              </div>
            </div>

            <div className={styles.filterDialogFooter}>
              <button
                type="button"
                className={styles.filterResetBtn}
                disabled={!stagedDirty && activeCount === 0}
                onClick={handleReset}
              >
                Reset
              </button>
              <button
                type="button"
                className={styles.filterApplyBtn}
                onClick={handleApply}
              >
                Apply filters
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function DiscoverActiveFilters({
  filters,
  totalMatches,
}: {
  filters: DiscoverFilters
  totalMatches: number
}) {
  const router = useRouter()
  const activeCount = countActiveDiscoverFilters(filters)
  if (activeCount === 0) return null

  function update(next: DiscoverFilters) {
    router.push(buildDiscoverHref(next, 1))
  }

  const ageLabel =
    filters.minAge !== null && filters.maxAge !== null
      ? `Age ${filters.minAge}–${filters.maxAge}`
      : filters.minAge !== null
        ? `Age ${filters.minAge}+`
        : filters.maxAge !== null
          ? `Up to ${filters.maxAge}`
          : null

  return (
    <div className={styles.activeFilterBar} aria-label="Active filters">
      <div className={styles.activeFilterChips}>
        {filters.campuses.map((campus) => (
          <button
            key={`campus-${campus}`}
            type="button"
            className={styles.activeFilterBtn}
            onClick={() =>
              update({ ...filters, campuses: filters.campuses.filter((c) => c !== campus) })
            }
            aria-label={`Remove ${campus} campus filter`}
          >
            <span>{campus}</span>
            <X size={13} aria-hidden="true" />
          </button>
        ))}

        {filters.lookingFor.map((intent) => (
          <button
            key={`intent-${intent}`}
            type="button"
            className={styles.activeFilterBtn}
            onClick={() =>
              update({ ...filters, lookingFor: filters.lookingFor.filter((i) => i !== intent) })
            }
            aria-label={`Remove ${intent} filter`}
          >
            <span>{intent}</span>
            <X size={13} aria-hidden="true" />
          </button>
        ))}

        {ageLabel && (
          <button
            type="button"
            className={styles.activeFilterBtn}
            onClick={() => update({ ...filters, minAge: null, maxAge: null })}
            aria-label="Remove age range filter"
          >
            <span>{ageLabel}</span>
            <X size={13} aria-hidden="true" />
          </button>
        )}

        {filters.verifiedOnly && (
          <button
            type="button"
            className={styles.activeFilterBtn}
            onClick={() => update({ ...filters, verifiedOnly: false })}
            aria-label="Remove verified only filter"
          >
            <span>Verified only</span>
            <X size={13} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className={styles.activeFilterMeta}>
        <span>
          {totalMatches} {totalMatches === 1 ? 'member' : 'members'}
        </span>
        <button
          type="button"
          className={styles.clearAllBtn}
          onClick={() => update(EMPTY_DISCOVER_FILTERS)}
        >
          Clear all
        </button>
      </div>
    </div>
  )
}
