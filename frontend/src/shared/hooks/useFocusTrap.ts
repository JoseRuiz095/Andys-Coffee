import { useEffect, useRef, useState, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Open traps, innermost last: only the top one handles Tab (a confirm opened over a modal). */
const trapStack: HTMLElement[] = []

function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => !element.closest('[inert]'))
}

function handleTab(event: KeyboardEvent) {
  if (event.key !== 'Tab') return
  const container = trapStack.at(-1)
  if (!container) return
  const focusable = focusableIn(container)
  if (focusable.length === 0) {
    event.preventDefault()
    container.focus()
    return
  }
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement
  if (event.shiftKey && (active === first || !container.contains(active))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (active === last || !container.contains(active))) {
    event.preventDefault()
    first.focus()
  }
}

/**
 * Keeps keyboard focus inside an open dialog: moves it in when it opens (respecting an
 * `autoFocus` field or `initialFocusRef`), cycles Tab within it, and gives it back to the element
 * that opened the dialog when it closes. The container needs `tabIndex={-1}`.
 */
export function useFocusTrap(
  isOpen: boolean,
  containerRef: RefObject<HTMLElement | null>,
  initialFocusRef?: { current: HTMLElement | null },
) {
  // The opener is read while rendering the opening: by the time effects run, an autoFocus field
  // inside the dialog has already taken the focus.
  const [opener, setOpener] = useState<Element | null>(() => (isOpen ? document.activeElement : null))
  const [wasOpen, setWasOpen] = useState(isOpen)
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen)
    setOpener(isOpen ? document.activeElement : null)
  }
  const openerRef = useRef<Element | null>(null)
  useEffect(() => {
    openerRef.current = opener
  }, [opener])

  useEffect(() => {
    if (!isOpen) return
    const container = containerRef.current
    if (!container) return

    trapStack.push(container)
    if (trapStack.length === 1) document.addEventListener('keydown', handleTab, true)

    if (!container.contains(document.activeElement)) {
      const target = initialFocusRef?.current ?? focusableIn(container)[0] ?? container
      target.focus()
    }

    return () => {
      const index = trapStack.indexOf(container)
      if (index !== -1) trapStack.splice(index, 1)
      if (trapStack.length === 0) document.removeEventListener('keydown', handleTab, true)
      const previous = openerRef.current
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [isOpen, containerRef, initialFocusRef])
}
