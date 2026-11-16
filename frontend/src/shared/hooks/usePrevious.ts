import { useEffect, useRef } from 'react'

/** The value from the previous render (undefined on the first one). */
export function usePrevious<T>(value: T) {
  const ref = useRef<T | undefined>(undefined)
  useEffect(() => {
    ref.current = value
  })
  // The ref intentionally exposes the value from the previous render.
  // eslint-disable-next-line react-hooks/refs
  return ref.current
}
