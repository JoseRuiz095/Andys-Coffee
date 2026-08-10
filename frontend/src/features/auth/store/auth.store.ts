import type { AuthUser } from '../types/auth.types'

type AuthState = {
  token: string | null
  user: AuthUser | null
}

const STORAGE_KEY = 'andys-auth-session'

function readStoredSession(): AuthState {
  if (typeof window === 'undefined') {
    return { token: null, user: null }
  }

  const stored = window.localStorage.getItem(STORAGE_KEY)

  if (!stored) {
    return { token: null, user: null }
  }

  try {
    const parsed = JSON.parse(stored) as AuthState
    return parsed
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
    return { token: null, user: null }
  }
}

const authState: AuthState = readStoredSession()

function persistSession(nextState: AuthState) {
  if (typeof window === 'undefined') {
    return
  }

  if (nextState.token && nextState.user) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
    return
  }

  window.localStorage.removeItem(STORAGE_KEY)
}

export const authStore = {
  getState() {
    return authState
  },
  setSession(token: string, user: AuthUser) {
    authState.token = token
    authState.user = user
    persistSession(authState)
    window.dispatchEvent(new Event('auth:changed'))
  },
  clearSession() {
    authState.token = null
    authState.user = null
    persistSession(authState)
    window.dispatchEvent(new Event('auth:changed'))
  },
}
