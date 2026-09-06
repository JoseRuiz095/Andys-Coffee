import type { AuthUser } from '../types/auth.types'

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
    window.dispatchEvent(new Event('auth:changed'))
  },
}
