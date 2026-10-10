import { useEffect, useRef } from 'react'

type OverlayEntry = {
  onEscape: () => void
}

const overlayStack: OverlayEntry[] = []

function handleEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return

  const topOverlay = overlayStack.at(-1)
  if (!topOverlay) return

  event.preventDefault()
  event.stopImmediatePropagation()
  topOverlay.onEscape()
}

export function useOverlayEscape(isOpen: boolean, onEscape: () => void) {
  const onEscapeRef = useRef(onEscape)

  useEffect(() => {
    onEscapeRef.current = onEscape
  }, [onEscape])

  useEffect(() => {
    if (!isOpen) return

    const entry: OverlayEntry = {
      onEscape: () => onEscapeRef.current(),
    }
    overlayStack.push(entry)

    if (overlayStack.length === 1) {
      document.addEventListener('keydown', handleEscape, true)
    }

    return () => {
      const index = overlayStack.indexOf(entry)
      if (index !== -1) overlayStack.splice(index, 1)
      if (overlayStack.length === 0) {
        document.removeEventListener('keydown', handleEscape, true)
      }
    }
  }, [isOpen])
}
