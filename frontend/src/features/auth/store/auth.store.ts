import type { AuthUser } from '../types/auth.types'

type AuthState = {
  token: string | null
  user: AuthUser | null
}

const authState: AuthState = {
  token: null,
  user: null,
}

export const authStore = {
  getState() {
    return authState
  },
  setSession(token: string, user: AuthUser) {
    authState.token = token
    authState.user = user
  },
}
