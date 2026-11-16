import { describe, expect, it } from 'vitest'
import { canGrantPermission, getRolePermissionsAccess, isRoleAssignable } from './permissionRules'
import type { AuthUser } from '../../auth/types/auth.types'

const actor = (permissions: string[]): AuthUser => ({ id: 'a', name: 'A', email: 'a@x.mx', roleId: 'r', isActive: true, permissions })
const role = (names: string[], isSystem = false) => ({ isSystem, permissions: names.map((name) => ({ permission: { name } })) })

describe('permission rules (mirror of role.service / user.service)', () => {
  it('only grants permissions the actor holds', () => {
    expect(canGrantPermission(actor(['sales.read']), 'sales.read')).toBe(true)
    expect(canGrantPermission(actor(['sales.read']), 'sales.cancel')).toBe(false)
  })

  it('a role is assignable only if all its permissions are held', () => {
    expect(isRoleAssignable(actor(['sales.read', 'sales.create']), role(['sales.read']))).toBe(true)
    expect(isRoleAssignable(actor(['sales.read']), role(['sales.read', 'cash.correct']))).toBe(false)
  })

  it('editing permissions needs users.update', () => {
    expect(getRolePermissionsAccess(actor(['users.read']), role([]))).toEqual({ canEdit: false, reason: 'no-update' })
  })

  it('a system role needs roles.manage_system_permissions', () => {
    expect(getRolePermissionsAccess(actor(['users.update']), role([], true))).toEqual({ canEdit: false, reason: 'system-role' })
    expect(getRolePermissionsAccess(actor(['users.update', 'roles.manage_system_permissions']), role([], true))).toEqual({ canEdit: true })
  })

  it('a role with a permission the actor lacks cannot be saved by them', () => {
    expect(getRolePermissionsAccess(actor(['users.update']), role(['cash.correct']))).toEqual({
      canEdit: false,
      reason: 'missing-permissions',
      missing: ['cash.correct'],
    })
  })
})
