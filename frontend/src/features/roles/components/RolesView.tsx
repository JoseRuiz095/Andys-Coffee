import { useState } from 'react'
import { sileo } from 'sileo'
import { Button } from '../../../shared/components/Button'
import { PageHeader } from '../../../shared/components/PageHeader'
import { TableSkeleton } from '../../../shared/components/TableSkeleton'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { StatusBadge } from '../../../shared/components/StatusBadge'
import { QueryErrorState } from '../../../shared/components/QueryErrorState'
import { RowActions, type RowAction } from '../../../shared/components/RowActions'
import { RoleFormModal } from './RoleFormModal'
import { RolePermissionsDrawer } from './RolePermissionsDrawer'
import { useRolesList, useDeleteRole } from '../hooks/useRoles'
import { getRolePermissionsAccess, isRoleAssignable } from '../utils/permissionRules'
import { hasPermission } from '../../auth/utils/permissions'
import { getErrorMessage } from '../../../shared/utils/errors'
import type { RoleData } from '../api/role.api'
import type { AuthUser } from '../../auth/types/auth.types'

interface RolesViewProps {
  currentUser: AuthUser | null
}

/** Why "Eliminar" is not offered for a role (the backend would reject it). */
function deleteBlockReason(role: RoleData): string | null {
  if (role.isSystem) return 'Rol del sistema'
  if (role._count.users > 0) return `Tiene ${role._count.users} ${role._count.users === 1 ? 'usuario' : 'usuarios'}`
  return null
}

/**
 * "Roles y permisos" — answers "what types of access exist?". Each role shows how many users
 * have it and how many permissions it grants; the permission set is edited (or only viewed) in
 * the shared RolePermissionsDrawer.
 */
export function RolesView({ currentUser }: RolesViewProps) {
  const canCreateRoles = hasPermission(currentUser, 'users.create')
  const canUpdateRoles = hasPermission(currentUser, 'users.update')
  const canDeleteRoles = hasPermission(currentUser, 'users.delete')

  const { data: roles, isLoading, isError, error, refetch, isFetching } = useRolesList()
  const { mutate: deleteRole, isPending: isDeleting } = useDeleteRole()

  // 'new' = creating; a role = editing it.
  const [form, setForm] = useState<'new' | RoleData | null>(null)
  const [permissionsRoleId, setPermissionsRoleId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RoleData | null>(null)

  const handleConfirmDelete = () => {
    if (!deleteTarget) return
    const target = deleteTarget
    deleteRole(target.id, {
      onSuccess: () => {
        sileo.success({ title: 'Rol eliminado', description: `El rol "${target.name}" fue eliminado.` })
        setDeleteTarget(null)
      },
      onError: (err: unknown) => {
        sileo.error({ title: 'No se pudo eliminar el rol', description: getErrorMessage(err, 'Inténtalo de nuevo.') })
      },
    })
  }

  const getActions = (role: RoleData): RowAction[] => {
    const canEditPermissions = getRolePermissionsAccess(currentUser, role).canEdit
    // A1: renaming or deleting a role needs every permission it grants (like editing them).
    const coversRole = isRoleAssignable(currentUser, role)
    const blockReason = deleteBlockReason(role)
    return [
      {
        label: canEditPermissions ? 'Permisos' : 'Ver permisos',
        ariaLabel: `${canEditPermissions ? 'Editar' : 'Ver'} permisos del rol ${role.name}`,
        onClick: () => setPermissionsRoleId(role.id),
      },
      ...(canUpdateRoles && coversRole ? [{ label: 'Editar', ariaLabel: `Editar el rol ${role.name}`, onClick: () => setForm(role) }] : []),
      ...(canDeleteRoles && coversRole && !blockReason
        ? [{ label: 'Eliminar', ariaLabel: `Eliminar el rol ${role.name}`, onClick: () => setDeleteTarget(role), disabled: isDeleting, danger: true }]
        : []),
    ]
  }

  return (
    <div>
      <PageHeader
        title="Roles y permisos"
        description="Cada rol define lo que pueden hacer los usuarios que lo tienen."
        actions={
          canCreateRoles && (
            <Button variant="primary" onClick={() => setForm('new')}>
              + Nuevo rol
            </Button>
          )
        }
      />

      {isLoading ? (
        <TableSkeleton rows={3} columns={3} />
      ) : isError ? (
        <QueryErrorState error={error} subject="los roles" onRetry={() => void refetch()} isRetrying={isFetching} />
      ) : !roles || roles.length === 0 ? (
        <div className="rounded-xl border px-4 py-8 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
          No hay roles configurados.
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          {roles.map((role) => {
            const blockReason = canDeleteRoles ? deleteBlockReason(role) : null
            return (
              <li key={role.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      {role.name}
                    </p>
                    {role.isSystem && <StatusBadge tone="neutral">Del sistema</StatusBadge>}
                  </div>
                  {role.description && (
                    <p className="truncate text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {role.description}
                    </p>
                  )}
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {role._count.users} {role._count.users === 1 ? 'usuario' : 'usuarios'} · {role.permissions.length}{' '}
                    {role.permissions.length === 1 ? 'permiso' : 'permisos'}
                    {blockReason && ` · No se puede eliminar: ${blockReason.toLowerCase()}`}
                  </p>
                </div>
                <RowActions actions={getActions(role)} />
              </li>
            )
          })}
        </ul>
      )}

      {form !== null && (
        <RoleFormModal
          key={form === 'new' ? 'new' : form.id}
          editingRole={form === 'new' ? null : form}
          onClose={() => setForm(null)}
          onSuccess={(role) => {
            setForm(null)
            // A new role has no permissions yet: open them right away.
            if (form === 'new') setPermissionsRoleId(role.id)
          }}
        />
      )}

      <RolePermissionsDrawer roleId={permissionsRoleId} currentUser={currentUser} onClose={() => setPermissionsRoleId(null)} />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Eliminar rol"
        message={`¿Eliminar el rol "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        isDangerous
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
