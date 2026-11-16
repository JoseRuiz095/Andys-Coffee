import { useSyncExternalStore } from 'react'
import { authStore } from '../store/auth.store'
import type { AuthUser } from '../types/auth.types'

function subscribe(onChange: () => void) {
  window.addEventListener('auth:changed', onChange)
  return () => window.removeEventListener('auth:changed', onChange)
}

const getUser = () => authStore.getState().user

/**
 * The logged-in user, re-rendering when the session changes (login, logout, refreshed
 * permissions). Replaces reading `authStore.getState()` once, which never updated.
 */
export function useCurrentUser(): AuthUser | null {
  return useSyncExternalStore(subscribe, getUser, getUser)
}
