import type { AuthUser } from '../types/auth.types'

export function hasPermission(user: AuthUser | null, permission: string): boolean {
  return user?.permissions?.includes(permission) ?? false
}

/**
 * Business, finance and inventory settings (distribution, fixed expenses, accumulated balances,
 * general and inventory preferences). Must match backend/src/config/permissions.ts.
 */
export const SETTINGS_PERMISSION = 'settings.manage'
