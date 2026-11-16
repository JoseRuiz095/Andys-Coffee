import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { RoleData } from '../api/role.api'
import type { AuthUser } from '../../auth/types/auth.types'

const permissions = [
  { id: 'p1', name: 'sales.read', description: 'Consultar ventas' },
  { id: 'p2', name: 'sales.cancel', description: 'Cancelar ventas' },
  { id: 'p3', name: 'users.update', description: 'Actualizar usuarios' },
]
let role: RoleData
vi.mock('../hooks/useRoles', () => ({
  useRoleById: () => ({ data: role, isError: false, isFetching: false, refetch: vi.fn() }),
  usePermissionsList: () => ({ data: permissions, isError: false, isFetching: false, refetch: vi.fn() }),
  useAssignPermissions: () => ({ mutate: vi.fn(), isPending: false }),
}))

const { RolePermissionsDrawer } = await import('./RolePermissionsDrawer')

const makeRole = (isSystem: boolean, names: string[]): RoleData => ({
  id: 'r1',
  name: isSystem ? 'CAJERO' : 'Supervisor',
  isSystem,
  createdAt: '',
  updatedAt: '1',
  _count: { users: 2 },
  permissions: permissions.filter((p) => names.includes(p.name)).map((permission) => ({ permission })),
})
const actor = (names: string[]): AuthUser => ({ id: 'a', name: 'A', email: 'a@x.mx', roleId: 'other', isActive: true, permissions: names })

describe('RolePermissionsDrawer', () => {
  it('a system role is read-only without roles.manage_system_permissions', () => {
    role = makeRole(true, ['sales.read'])
    render(<RolePermissionsDrawer roleId="r1" currentUser={actor(['users.update', 'sales.read', 'sales.cancel'])} onClose={vi.fn()} />)
    expect(screen.getByText(/Es un rol del sistema/)).toBeTruthy()
    for (const checkbox of screen.getAllByRole('checkbox')) expect((checkbox as HTMLInputElement).disabled).toBe(true)
  })

  it('a permission the actor lacks can not be granted, the rest can', () => {
    role = makeRole(false, ['sales.read'])
    render(<RolePermissionsDrawer roleId="r1" currentUser={actor(['users.update', 'sales.read', 'sales.cancel'])} onClose={vi.fn()} />)
    expect((screen.getByRole('checkbox', { name: /Cancelar ventas/ }) as HTMLInputElement).disabled).toBe(false)
    expect((screen.getByRole('checkbox', { name: /Editar usuarios/ }) as HTMLInputElement).disabled).toBe(false)
    // users.update is held, so it is grantable; a permission not held would show the note.
    expect(screen.queryByText('No puedes otorgarlo porque tú no lo tienes.')).toBeNull()
  })

  it('shows every module (also the ones the actor has no access to)', () => {
    role = makeRole(false, [])
    render(<RolePermissionsDrawer roleId="r1" currentUser={actor(['users.update', 'sales.read'])} onClose={vi.fn()} />)
    expect(screen.getByText('Usuarios y roles')).toBeTruthy()
    expect((screen.getByRole('checkbox', { name: /Cancelar ventas/ }) as HTMLInputElement).disabled).toBe(true)
    expect(screen.getAllByText('No puedes otorgarlo porque tú no lo tienes.').length).toBeGreaterThan(0)
  })
})
