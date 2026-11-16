import { getCurrentUser } from './auth.service'
import { authStore } from '../store/auth.store'

/**
 * Re-reads the logged-in user (role and permissions fresh from the DB) so the UI shows what the
 * backend allows right now. A 401 is handled by the API client; other errors keep the session.
 */
export async function refreshSession(): Promise<void> {
  if (!authStore.getState().user) return
  try {
    const user = await getCurrentUser()
    // The session may have been closed while the request was in flight.
    if (authStore.getState().user) authStore.setSession(user)
  } catch {
    // 401: the API client already cleared the session. Network errors: try again later.
  }
}

/** True when the role just changed is the logged-in user's own (their UI must refresh now). */
export function isOwnRole(roleId: string): boolean {
  return authStore.getState().user?.roleId === roleId
}
