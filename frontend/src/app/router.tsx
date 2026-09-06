import { useEffect, useState } from 'react'
import { LoginPage } from '../features/auth'
import { DashboardPage } from '../features/dashboard'
import { SettingsPage } from '../features/settings'
import { authStore } from '../features/auth/store/auth.store'
import { getCurrentUser } from '../features/auth/services/auth.service'
import { APP_ROUTES } from '../shared/constants/routes'

export function AppRouter() {
  const [pathname, setPathname] = useState(() => window.location.pathname)
  const [session, setSession] = useState(authStore.getState())
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  useEffect(() => {
    const handleRouteChange = () => {
      setPathname(window.location.pathname)
    }

    const handleAuthChange = () => {
      setSession(authStore.getState())
    }

    window.addEventListener('popstate', handleRouteChange)
    window.addEventListener('auth:changed', handleAuthChange)

    return () => {
      window.removeEventListener('popstate', handleRouteChange)
      window.removeEventListener('auth:changed', handleAuthChange)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    getCurrentUser()
      .then((user) => {
        if (isMounted) authStore.setSession(user)
      })
      .catch(() => {
        if (isMounted) authStore.clearSession()
      })
      .finally(() => {
        if (isMounted) setIsCheckingSession(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (isCheckingSession) return

    const isAuthenticated = Boolean(session.user)

    if (!isAuthenticated && pathname !== APP_ROUTES.login) {
      window.history.replaceState({}, '', APP_ROUTES.login)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPathname(APP_ROUTES.login)
      return
    }

    if (isAuthenticated && pathname === APP_ROUTES.login) {
      window.history.replaceState({}, '', APP_ROUTES.dashboard)
      setPathname(APP_ROUTES.dashboard)
    }
  }, [isCheckingSession, pathname, session.user])

  if (isCheckingSession) {
    return null
  }

  if (pathname === APP_ROUTES.dashboard) {
    return <DashboardPage />
  }

  if (pathname === APP_ROUTES.settings) {
    return <SettingsPage />
  }

  return <LoginPage />
}
