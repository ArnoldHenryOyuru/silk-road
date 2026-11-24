'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './ProfilePhoto.module.css'

export default function ProfilePhoto({
  src,
  alt,
  initials,
  gradient = 'linear-gradient(135deg, #8A72FF, #6C4FF6)',
  priority = false,
  className = '',
  children,
}: {
  src: string | null | undefined
  alt: string
  initials: string
  gradient?: string
  priority?: boolean
  className?: string
  children?: React.ReactNode
}) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const [erroredSrc, setErroredSrc] = useState<string | null>(null)

  const hasValidSrc = Boolean(src) && erroredSrc !== src
  const isLoaded = Boolean(src) && loadedSrc === src

  useEffect(() => {
    const el = imgRef.current
    if (!el || !src) return
    if (el.complete) {
      if (el.naturalWidth > 0) {
        const frame = requestAnimationFrame(() => setLoadedSrc(src))
        return () => cancelAnimationFrame(frame)
      } else {
        const frame = requestAnimationFrame(() => setErroredSrc(src))
        return () => cancelAnimationFrame(frame)
      }
    }
  }, [src])

  return (
    <div
      className={`${styles.wrap} ${className}`}
      style={!hasValidSrc ? { background: gradient } : undefined}
    >
      {hasValidSrc ? (
        <>
          {!isLoaded && <div className={styles.shimmer} aria-hidden="true" />}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src!}
            alt={alt}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={priority ? 'high' : 'auto'}
            referrerPolicy="no-referrer"
            className={`${styles.img} ${isLoaded ? styles.loaded : ''}`}
            onLoad={() => setLoadedSrc(src!)}
            onError={() => setErroredSrc(src!)}
          />
        </>
      ) : (
        <span className={styles.initials}>{initials}</span>
      )}
      {children}
    </div>
  )
}
