import type { AuthUser } from '../../auth/types/auth.types'
import { hasPermission } from '../../auth/utils/permissions'

/**
 * The same rules the backend applies (backend/src/services/role.service.ts and user.service.ts),
 * so the UI offers only what the server accepts. The backend stays the real enforcement point.
 */

interface RoleLike {
  isSystem: boolean
  permissions: Array<{ permission: { name: string } }>
}

const permissionNames = (role: RoleLike) => role.permissions.map((p) => p.permission.name)

/** Nobody can grant a permission they don't have. */
export function canGrantPermission(actor: AuthUser | null, permissionName: string): boolean {
  return hasPermission(actor, permissionName)
}

/** A role can be assigned to a user only when the actor holds every permission it grants. */
export function isRoleAssignable(actor: AuthUser | null, role: RoleLike): boolean {
  return permissionNames(role).every((name) => hasPermission(actor, name))
}

export type RolePermissionsAccess =
  | { canEdit: true }
  | { canEdit: false; reason: 'no-update' | 'system-role' | 'missing-permissions'; missing?: string[] }

/**
 * Saving sends the role's whole permission set, and the backend checks the actor holds each one:
 * a role with a permission the actor lacks can't be saved by them at all.
 */
export function getRolePermissionsAccess(actor: AuthUser | null, role: RoleLike): RolePermissionsAccess {
  if (!hasPermission(actor, 'users.update')) return { canEdit: false, reason: 'no-update' }
  if (role.isSystem && !hasPermission(actor, 'roles.manage_system_permissions')) {
    return { canEdit: false, reason: 'system-role' }
  }
  const missing = permissionNames(role).filter((name) => !hasPermission(actor, name))
  if (missing.length > 0) return { canEdit: false, reason: 'missing-permissions', missing }
  return { canEdit: true }
}
