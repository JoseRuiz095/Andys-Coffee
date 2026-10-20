import { useState } from 'react'
import brandLogo from '../assets/logo/LetraAndysVector.svg'

interface ProductImageProps {
  /** Public URL from the API (product.imageUrl); null/undefined shows the brand fallback. */
  src?: string | null
  alt: string
  /** Size and shape come from the container; the image fills it. */
  className?: string
  /** Load right away (e.g. an open dialog) instead of when scrolled into view. */
  eager?: boolean
}

/**
 * Product photo with a consistent fallback: products without an image, or whose image fails to
 * load, show the Andy's logo instead of a broken icon. The parent sets the box size, so the
 * layout does not shift while the image loads.
 */
export function ProductImage({ src, alt, className = '', eager = false }: ProductImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showFallback = !src || failedSrc === src

  if (showFallback) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center ${className}`}
        style={{ backgroundColor: 'var(--color-background)' }}
        role="img"
        aria-label={alt}
      >
        <img src={brandLogo} alt="" aria-hidden="true" className="h-1/3 w-auto max-w-[60%] object-contain opacity-40" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailedSrc(src)}
      className={`h-full w-full object-cover ${className}`}
    />
  )
}
