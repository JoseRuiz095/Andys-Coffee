import { useEffect } from 'react'

let lockCount = 0
let scrollPosition = 0
let originalBodyStyles: {
  overflow: string
  position: string
  top: string
  width: string
} | null = null

function lockBody() {
  if (lockCount === 0) {
    scrollPosition = window.scrollY
    originalBodyStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    }
    document.body.style.overflow = 'hidden'
    document.body.style.top = `-${scrollPosition}px`
    document.body.style.position = 'fixed'
    document.body.style.width = '100%'
  }
  lockCount += 1
}

function unlockBody() {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount > 0) return

  document.body.style.overflow = originalBodyStyles?.overflow ?? ''
  document.body.style.position = originalBodyStyles?.position ?? ''
  document.body.style.top = originalBodyStyles?.top ?? ''
  document.body.style.width = originalBodyStyles?.width ?? ''
  originalBodyStyles = null
  window.scrollTo(0, scrollPosition)
}

export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return
    lockBody()
    return unlockBody
  }, [isLocked])
}
