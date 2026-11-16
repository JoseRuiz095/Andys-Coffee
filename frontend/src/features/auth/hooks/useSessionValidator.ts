import { useEffect, useState } from 'react'
import { authStore } from '../store/auth.store'
import { refreshSession } from '../services/refreshSession'
import { PERMISSIONS_STALE_EVENT } from '../../../app/api'

const SESSION_CHECK_INTERVAL = 30 * 60 * 1000 // 30 minutos
/** At most one extra re-read per minute after 403s (several queries can fail at once). */
const FORBIDDEN_RECHECK_GAP = 60 * 1000

/**
 * While someone is logged in, re-reads the session every 30 minutes: an expired one is handled
 * (and announced) by the API client's 401 handler, and a live one refreshes the user so role or
 * permission changes reach the UI without a reload. A 403 triggers that re-read right away (once
 * a minute at most), so actions the role no longer allows disappear. Nothing runs on the login screen.
 */
export function useSessionValidator() {
  const [hasSession, setHasSession] = useState(() => authStore.getState().user !== null)

  useEffect(() => {
    const sync = () => setHasSession(authStore.getState().user !== null)
    window.addEventListener('auth:changed', sync)
    return () => window.removeEventListener('auth:changed', sync)
  }, [])

  useEffect(() => {
    if (!hasSession) return

    let lastForbiddenCheck = 0
    const onForbidden = () => {
      const now = Date.now()
      if (now - lastForbiddenCheck < FORBIDDEN_RECHECK_GAP) return
      lastForbiddenCheck = now
      void refreshSession()
    }

    const interval = setInterval(() => void refreshSession(), SESSION_CHECK_INTERVAL)
    window.addEventListener(PERMISSIONS_STALE_EVENT, onForbidden)
    return () => {
      clearInterval(interval)
      window.removeEventListener(PERMISSIONS_STALE_EVENT, onForbidden)
    }
  }, [hasSession])
}
