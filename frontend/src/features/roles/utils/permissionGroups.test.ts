import { describe, expect, it } from 'vitest'
import { getModuleLabel, getPermissionLabel, getPermissionNote, groupPermissionsByModule, isSensitivePermission } from './permissionGroups'

const p = (name: string, description?: string) => ({ id: name, name, description })

describe('permission groups', () => {
  it('labels every seeded module in Spanish', () => {
    const expected: Record<string, string> = {
      users: 'Usuarios y roles', settings: 'Configuración', roles: 'Roles', products: 'Productos', categories: 'Categorías', sales: 'Ventas',
      cash: 'Caja', dashboard: 'Administración', expenses: 'Gastos', reports: 'Reportes', inventory: 'Inventario',
    }
    for (const [module, label] of Object.entries(expected)) expect(getModuleLabel(module)).toBe(label)
    expect(getModuleLabel('categories')).toBe('Categorías')
  })

  it('orders read, create, update, delete and then the special ones', () => {
    const [sales] = groupPermissionsByModule([
      p('sales.cancel'), p('sales.update'), p('sales.create'), p('sales.read'), p('sales.approve_cancellation'),
    ])
    expect(sales.permissions.map((x) => x.name)).toEqual([
      'sales.read', 'sales.create', 'sales.update', 'sales.approve_cancellation', 'sales.cancel',
    ])
  })

  it('explains what users.update really allows and marks sensitive permissions', () => {
    const update = p('users.update', 'Actualizar usuarios')
    expect(getPermissionLabel(update)).toBe('Editar usuarios')
    expect(getPermissionNote(update)).toMatch(/roles y sus permisos/)
    expect(isSensitivePermission(update)).toBe(true)
    expect(isSensitivePermission(p('sales.read'))).toBe(false)
    // Without an override the DB description is used.
    expect(getPermissionLabel(p('sales.read', 'Consultar ventas'))).toBe('Consultar ventas')
  })
})
