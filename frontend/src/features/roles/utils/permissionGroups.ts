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
  // users.* also guards roles and permissions; settings.manage guards the business settings.
  users: 'Usuarios y roles',
  settings: 'Configuración',
  roles: 'Roles',
  products: 'Productos',
  categories: 'Categorías',
  sales: 'Ventas',
  cash: 'Caja',
  dashboard: 'Administración',
  expenses: 'Gastos',
  reports: 'Reportes',
  inventory: 'Inventario',
}

interface PermissionInfo {
  /** Replaces the DB description when it is too technical or hides what the permission allows. */
  label?: string
  /** One short line on what else it allows. */
  note?: string
  /** Grants access to money, other users or irreversible operations. */
  sensitive?: boolean
}

const PERMISSION_INFO: Record<string, PermissionInfo> = {
  'users.read': { note: 'También deja consultar roles, permisos y los datos del negocio.' },
  'users.create': { label: 'Crear usuarios y roles', sensitive: true },
  'users.update': {
    label: 'Editar usuarios',
    note: 'También deja editar roles y sus permisos.',
    sensitive: true,
  },
  'users.delete': { label: 'Eliminar usuarios y roles', sensitive: true },
  'roles.manage_system_permissions': { note: 'Necesario para cambiar los permisos de ADMIN y CAJERO.', sensitive: true },
  'sales.cancel': { sensitive: true },
  'sales.approve_cancellation': { sensitive: true },
  'cash.correct': { label: 'Corregir o reabrir un corte de caja', sensitive: true },
  'dashboard.read': { label: 'Consultar resumen, estado de resultados y métricas' },
  'expenses.delete': { sensitive: true },
  'settings.manage': {
    label: 'Cambiar la configuración',
    note: 'Datos del negocio, distribución, gastos fijos, saldos acumulados y ajustes de inventario.',
    sensitive: true,
  },
  'reports.read': { note: 'Sin efecto por ahora: el módulo de reportes está planeado.' },
  'inventory.adjust': { sensitive: true },
}

// Reading first, then creating, editing and deleting; special permissions last.
const ACTION_ORDER = ['read', 'view', 'create', 'update', 'delete']

export function getModuleFromPermissionName(name: string): string {
  const [module] = name.split('.')
  return module
}

export function getModuleLabel(module: string): string {
  return MODULE_LABELS[module] ?? module.charAt(0).toUpperCase() + module.slice(1)
}

export function getPermissionLabel(permission: Permission): string {
  const info = PERMISSION_INFO[permission.name]
  if (info?.label) return info.label
  if (permission.description) return permission.description

  const [, action] = permission.name.split('.')
  if (!action) return permission.name

  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function getPermissionNote(permission: Permission): string | undefined {
  return PERMISSION_INFO[permission.name]?.note
}

export function isSensitivePermission(permission: Permission): boolean {
  return PERMISSION_INFO[permission.name]?.sensitive ?? false
}

function actionRank(name: string): number {
  const [, action = ''] = name.split('.')
  const index = ACTION_ORDER.indexOf(action)
  return index === -1 ? ACTION_ORDER.length : index
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
      permissions: [...modulePermissions].sort(
        (a, b) => actionRank(a.name) - actionRank(b.name) || a.name.localeCompare(b.name),
      ),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}
