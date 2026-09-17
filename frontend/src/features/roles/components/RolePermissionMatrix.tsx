import { useState } from 'react'
import { Skeleton } from '../../../shared/components/Skeleton'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { useRolesList, usePermissionsList, useAssignPermissions, useDeleteRole } from '../hooks/useRoles'
import { hasPermission } from '../../auth/utils/permissions'
import { sileo } from 'sileo'
import type { AuthUser } from '../../auth/types/auth.types'

interface RolePermissionMatrixProps {
  currentUser?: AuthUser | null
}

export function RolePermissionMatrix({ currentUser = null }: RolePermissionMatrixProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; roleId: string | null; roleName: string }>({
    isOpen: false,
    roleId: null,
    roleName: '',
  })
  const canUpdateRoles = hasPermission(currentUser, 'users.update')
  const canDeleteRoles = hasPermission(currentUser, 'users.delete')
  const { data: roles, isLoading: rolesLoading, isError: rolesError, refetch: refetchRoles } = useRolesList()
  const { data: permissions, isLoading: permissionsLoading, isError: permissionsError } = usePermissionsList()
  const { mutate: assignPermissions, isPending: isAssigning } = useAssignPermissions()
  const { mutate: deleteRole, isPending: isDeleting } = useDeleteRole()

  const handleTogglePermission = (roleId: string, permissionId: string, currentPermissionIds: string[]) => {
    const nextIds = currentPermissionIds.includes(permissionId)
      ? currentPermissionIds.filter((id) => id !== permissionId)
      : [...currentPermissionIds, permissionId]

    assignPermissions(
      { id: roleId, permissionIds: nextIds },
      {
        onError: (error: any) => {
          const message = error?.response?.data?.message || 'Error al asignar permisos'
          sileo.error({ title: 'Error', description: message })
        },
      }
    )
  }

  const handleDeleteRole = (roleId: string, roleName: string) => {
    setDeleteConfirm({ isOpen: true, roleId, roleName })
  }

  const handleConfirmDelete = () => {
    if (deleteConfirm.roleId) {
      deleteRole(deleteConfirm.roleId, {
        onSuccess: () => {
          sileo.success({ title: 'Rol eliminado', description: `El rol "${deleteConfirm.roleName}" fue eliminado exitosamente.` })
          refetchRoles()
          setDeleteConfirm({ isOpen: false, roleId: null, roleName: '' })
        },
        onError: (error: any) => {
          const message = error?.response?.data?.message || 'Error al eliminar rol'
          sileo.error({ title: 'Error', description: message })
        },
      })
    }
  }

  const handleCancelDelete = () => {
    setDeleteConfirm({ isOpen: false, roleId: null, roleName: '' })
  }

  if (rolesLoading || permissionsLoading) {
    return <Skeleton className="h-96" />
  }

  if (rolesError || permissionsError) {
    return (
      <div className="rounded-lg border p-6" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Error al cargar datos</h3>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {rolesError && 'No se pudieron cargar los roles. '}
          {permissionsError && 'No se pudieron cargar los permisos.'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          Reintentar
        </button>
      </div>
    )
  }

  const rolesList = roles || []
  const permissionsList = permissions || []

  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
      <table className="w-full" style={{ backgroundColor: 'var(--color-surface)' }}>
        <thead>
          <tr className="border-b" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--color-text-secondary)' }}>
              Permiso
            </th>
            {rolesList.map((role) => (
              <th key={role.id} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--color-text-secondary)' }}>
                <div className="flex flex-col items-center gap-2">
                  <span>{role.name}</span>
                  {canDeleteRoles && !role.isSystem && (
                    <button
                      onClick={() => handleDeleteRole(role.id, role.name)}
                      disabled={isDeleting}
                      className="text-xs text-[var(--color-danger)] hover:text-red-800 disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {permissionsList.map((permission) => (
            <tr key={permission.id} className="border-t" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
              <td className="px-4 py-3 text-sm">
                <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{permission.name}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{permission.description}</p>
              </td>
              {rolesList.map((role) => {
                const rolePermissionIds = role.permissions.map((p) => p.permission.id)
                const isChecked = rolePermissionIds.includes(permission.id)

                return (
                  <td key={`${role.id}-${permission.id}`} className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() =>
                        handleTogglePermission(role.id, permission.id, rolePermissionIds)
                      }
                      disabled={isAssigning || !canUpdateRoles}
                      className="h-4 w-4 accent-[var(--color-primary)] disabled:opacity-50"
                      title={!canUpdateRoles ? 'No tienes permiso para cambiar permisos' : ''}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Eliminar Rol"
        message={`¿Estás seguro de que deseas eliminar el rol "${deleteConfirm.roleName}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        isDangerous={true}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  )
}
