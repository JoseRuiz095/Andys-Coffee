import { useEffect } from 'react'

let lockCount = 0
let scrollPosition = 0

function lockBody() {
  if (lockCount === 0) {
    scrollPosition = window.scrollY
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

  document.body.style.overflow = ''
  document.body.style.position = ''
  document.body.style.top = ''
  document.body.style.width = ''
  window.scrollTo(0, scrollPosition)
}

export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return
    lockBody()
    return unlockBody
  }, [isLocked])
}
