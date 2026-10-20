import { useEffect, useRef, useState } from 'react'
import { PRODUCT_IMAGE_ACCEPT, PRODUCT_IMAGE_MAX_MB } from '../../../shared/constants/images'

export interface ImageDraft {
  file: File
  /** Local object URL for the preview (nothing is uploaded until it is confirmed). */
  previewUrl: string
}

const ACCEPTED_TYPES = PRODUCT_IMAGE_ACCEPT.split(',')

/** A photo picked on the device but not uploaded yet: quick checks + local preview. */
export function useImageDraft() {
  const [draft, setDraft] = useState<ImageDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const previewRef = useRef<string | null>(null)

  const replacePreview = (next: ImageDraft | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = next?.previewUrl ?? null
    setDraft(next)
  }

  // Free the last preview when the form unmounts.
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
  }, [])

  const select = (file: File | null | undefined) => {
    if (!file) return
    if (file.type && !ACCEPTED_TYPES.includes(file.type)) {
      setError('Formato no admitido. Usa JPEG, PNG, WebP o AVIF.')
      return
    }
    if (file.size > PRODUCT_IMAGE_MAX_MB * 1024 * 1024) {
      setError(`La imagen supera ${PRODUCT_IMAGE_MAX_MB} MB.`)
      return
    }
    setError(null)
    replacePreview({ file, previewUrl: URL.createObjectURL(file) })
  }

  const clear = () => {
    setError(null)
    replacePreview(null)
  }

  return { draft, error, setError, select, clear }
}
