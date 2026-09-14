import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState, useRef } from 'react'
import { LoginPage } from '../features/auth'
import { DashboardPage } from '../features/dashboard'
import { SalePage } from '../features/menu/pages/SalePage'
import { SettingsPage } from '../features/settings'
import { InventoryCurrent } from '../features/inventory'
import { authStore } from '../features/auth/store/auth.store'
import { getCurrentUser } from '../features/auth/services/auth.service'
import { APP_ROUTES } from '../shared/constants/routes'

function usePrevious<T>(value: T) {
  const ref = useRef<T | undefined>(undefined)
  useEffect(() => {
    ref.current = value
  })
  // The ref intentionally exposes the value from the previous render.
  // eslint-disable-next-line react-hooks/refs
  return ref.current
}

export function AppRouter() {
  const [pathname, setPathname] = useState(() => window.location.pathname)
  const [session, setSession] = useState(authStore.getState())
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const prevPathname = usePrevious(pathname)

  const routeOrder: string[] = [APP_ROUTES.login, APP_ROUTES.dashboard, APP_ROUTES.menu, APP_ROUTES.inventory, APP_ROUTES.settings]
  const direction = prevPathname ? (routeOrder.indexOf(pathname) > routeOrder.indexOf(prevPathname) ? 1 : -1) : 1

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

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 100 : -100,
      opacity: 0,
    }),
  }

  return (
    <AnimatePresence initial={false} mode="sync" custom={direction}>
      {pathname === APP_ROUTES.dashboard && (
        <motion.div
          key={APP_ROUTES.dashboard}
          className="overflow-x-clip"
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{ willChange: 'transform, opacity' }}
        >
          <DashboardPage />
        </motion.div>
      )}

      {pathname === APP_ROUTES.menu && (
        <motion.div
          key={APP_ROUTES.menu}
          className="overflow-x-clip"
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{ willChange: 'transform, opacity' }}
        >
          <SalePage />
        </motion.div>
      )}

      {pathname === APP_ROUTES.inventory && (
        <motion.div
          key={APP_ROUTES.inventory}
          className="overflow-x-clip"
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{ willChange: 'transform, opacity' }}
        >
          <InventoryCurrent />
        </motion.div>
      )}

      {pathname === APP_ROUTES.settings && (
        <motion.div
          key={APP_ROUTES.settings}
          className="overflow-x-clip"
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{ willChange: 'transform, opacity' }}
        >
          <SettingsPage />
        </motion.div>
      )}

      {pathname === APP_ROUTES.login && (
        <motion.div
          key={APP_ROUTES.login}
          className="overflow-x-clip"
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{ willChange: 'transform, opacity' }}
        >
          <LoginPage />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
