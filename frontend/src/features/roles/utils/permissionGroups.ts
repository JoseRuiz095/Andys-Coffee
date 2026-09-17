import type { Permission } from '../api/role.api'

export interface PermissionGroup {
  module: string
  label: string
  permissions: Permission[]
}

/**
 * Permission.name is a single free-form string like "sales.create" — there is
 * no separate module/resource column in the schema (by design, per project
 * constraints: no new permission categories in the DB just for the UI). The
 * module is always the prefix before the first dot, so grouping happens
 * entirely on the client from data the API already returns.
 */
const MODULE_LABELS: Record<string, string> = {
  users: 'Usuarios',
  roles: 'Roles',
  products: 'Productos',
  sales: 'Ventas',
  cash: 'Caja',
  dashboard: 'Dashboard',
  expenses: 'Gastos',
  reports: 'Reportes',
  inventory: 'Inventario',
}

export function getModuleFromPermissionName(name: string): string {
  const [module] = name.split('.')
  return module
}

export function getModuleLabel(module: string): string {
  return MODULE_LABELS[module] ?? module.charAt(0).toUpperCase() + module.slice(1)
}

export function getPermissionLabel(permission: Permission): string {
  if (permission.description) return permission.description

  const [, action] = permission.name.split('.')
  if (!action) return permission.name

  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function groupPermissionsByModule(permissions: Permission[]): PermissionGroup[] {
  const groups = new Map<string, Permission[]>()

  for (const permission of permissions) {
    const module = getModuleFromPermissionName(permission.name)
    const existing = groups.get(module) ?? []
    existing.push(permission)
    groups.set(module, existing)
  }

  return Array.from(groups.entries())
    .map(([module, modulePermissions]) => ({
      module,
      label: getModuleLabel(module),
      permissions: modulePermissions,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}
