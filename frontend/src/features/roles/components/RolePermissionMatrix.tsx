import { Skeleton } from '../../../shared/components/Skeleton'
import { useRolesList, usePermissionsList, useAssignPermissions, useDeleteRole } from '../hooks/useRoles'
import { hasPermission } from '../../auth/utils/permissions'
import { sileo } from 'sileo'
import type { AuthUser } from '../../auth/types/auth.types'

interface RolePermissionMatrixProps {
  currentUser?: AuthUser | null
}

export function RolePermissionMatrix({ currentUser = null }: RolePermissionMatrixProps) {
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
    if (confirm(`¿Estás seguro de que deseas eliminar el rol "${roleName}"?`)) {
      deleteRole(roleId, {
        onSuccess: () => {
          sileo.success({ title: 'Rol eliminado', description: `El rol "${roleName}" fue eliminado exitosamente.` })
          refetchRoles()
        },
        onError: (error: any) => {
          const message = error?.response?.data?.message || 'Error al eliminar rol'
          sileo.error({ title: 'Error', description: message })
        },
      })
    }
  }

  if (rolesLoading || permissionsLoading) {
    return <Skeleton className="h-96" />
  }

  if (rolesError || permissionsError) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-6">
        <h3 className="font-semibold text-red-800">Error al cargar datos</h3>
        <p className="mt-2 text-sm text-red-700">
          {rolesError && 'No se pudieron cargar los roles. '}
          {permissionsError && 'No se pudieron cargar los permisos.'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const rolesList = roles || []
  const permissionsList = permissions || []

  return (
    <div className="overflow-x-auto rounded-lg border border-[#E7E3DC]">
      <table className="w-full">
        <thead>
          <tr className="bg-[#FDFBF7] border-b border-[#E7E3DC]">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[#6B7280]">
              Permiso
            </th>
            {rolesList.map((role) => (
              <th key={role.id} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-[#6B7280]">
                <div className="flex flex-col items-center gap-2">
                  <span>{role.name}</span>
                  {canDeleteRoles && !role.isSystem && (
                    <button
                      onClick={() => handleDeleteRole(role.id, role.name)}
                      disabled={isDeleting}
                      className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
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
            <tr key={permission.id} className="border-t border-[#E7E3DC] hover:bg-[#FDFBF7]">
              <td className="px-4 py-3 text-sm">
                <p className="font-semibold text-[#2C211D]">{permission.name}</p>
                <p className="text-xs text-[#6B7280]">{permission.description}</p>
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
                      className="h-4 w-4 accent-[#5A804F] disabled:opacity-50"
                      title={!canUpdateRoles ? 'No tienes permiso para cambiar permisos' : ''}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
