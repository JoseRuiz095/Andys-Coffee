import { useEffect } from 'react'
import { getCurrentUser } from '../services/auth.service'
import { authStore } from '../store/auth.store'
import { sileo } from 'sileo'
import { getErrorStatus } from '../../../shared/utils/errors'

const SESSION_CHECK_INTERVAL = 30 * 60 * 1000 // 30 minutos

export function useSessionValidator() {
  useEffect(() => {
    const validateSession = async () => {
      try {
        await getCurrentUser()
      } catch (error: unknown) {
        if (getErrorStatus(error) === 401) {
          authStore.clearSession()
          sileo.error({
            title: 'Sesión expirada',
            description: 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.',
          })
        }
      }
    }

    const interval = setInterval(validateSession, SESSION_CHECK_INTERVAL)

    return () => clearInterval(interval)
  }, [])
}
