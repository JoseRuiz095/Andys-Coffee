import { useEffect, useState } from 'react'
import { LoginPage } from '../features/auth'
import { DashboardPage } from '../features/dashboard'
import { authStore } from '../features/auth/store/auth.store'
import { APP_ROUTES } from '../shared/constants/routes'

export function AppRouter() {
  const [pathname, setPathname] = useState(() => window.location.pathname)
  const [session, setSession] = useState(authStore.getState())

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
    const isAuthenticated = Boolean(session.token)

    if (!isAuthenticated && pathname !== APP_ROUTES.login) {
      window.history.replaceState({}, '', APP_ROUTES.login)
      setPathname(APP_ROUTES.login)
      return
    }

    if (isAuthenticated && pathname === APP_ROUTES.login) {
      window.history.replaceState({}, '', APP_ROUTES.dashboard)
      setPathname(APP_ROUTES.dashboard)
    }
  }, [pathname, session.token])

  if (pathname === APP_ROUTES.dashboard) {
    return <DashboardPage />
  }

  return <LoginPage />
}
