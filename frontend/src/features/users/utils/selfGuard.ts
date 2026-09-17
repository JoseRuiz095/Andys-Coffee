import { sileo } from 'sileo'
import type { AuthUser } from '../../auth/types/auth.types'

export function blockIfSelf(
  currentUser: AuthUser | null,
  targetUserId: string,
  action: 'desactivar' | 'eliminar'
): boolean {
  if (currentUser?.id !== targetUserId) return false
  sileo.error({
    title: 'No permitido',
    description: `No puedes ${action} tu propia cuenta.`,
  })
  return true
}
