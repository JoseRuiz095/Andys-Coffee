import type { AuthUser } from '../types/auth.types'
import { queryClient } from '../../../app/queryClient'

type AuthState = {
  user: AuthUser | null
}

const authState: AuthState = { user: null }

export const authStore = {
  getState() {
    return authState
  },
  setSession(user: AuthUser) {
    authState.user = user
    window.dispatchEvent(new Event('auth:changed'))
  },
  clearSession() {
    authState.user = null
    // The POS terminal is shared: whoever logs in next must not see the previous user's cached
    // orders, cash or admin data (possibly data their role can't read).
    queryClient.clear()
    window.dispatchEvent(new Event('auth:changed'))
  },
}
