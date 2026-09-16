import type { AuthUser } from '../types/auth.types'

export function hasPermission(user: AuthUser | null, permission: string): boolean {
  return user?.permissions?.includes(permission) ?? false
}
