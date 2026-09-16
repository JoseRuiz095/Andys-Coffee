import { Skeleton } from '../../../shared/components/Skeleton'
import { useRolesList, usePermissionsList, useAssignPermissions } from '../hooks/useRoles'
import { sileo } from 'sileo'

export function RolePermissionMatrix() {
  const { data: roles, isLoading: rolesLoading } = useRolesList()
  const { data: permissions, isLoading: permissionsLoading } = usePermissionsList()
  const { mutate: assignPermissions, isPending: isAssigning } = useAssignPermissions()

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

  if (rolesLoading || permissionsLoading) {
    return <Skeleton className="h-96" />
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
                {role.name}
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
                      disabled={isAssigning}
                      className="h-4 w-4 accent-[#5A804F] disabled:opacity-50"
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
