import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { RoleAPI, PermissionAPI } from '../api/role.api'
import { isOwnRole, refreshSession } from '../../auth/services/refreshSession'

const ROLE_KEY = 'roles'
const PERMISSION_KEY = 'permissions'

/** The users list shows each user's role name, so it is refreshed whenever a role changes. */
function invalidateRolesAndUsers(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: [ROLE_KEY, 'list'] })
  void queryClient.invalidateQueries({ queryKey: ['users'] })
}

export const useRolesList = () => {
  return useQuery({
    queryKey: [ROLE_KEY, 'list'],
    queryFn: () => RoleAPI.getAll(),
    staleTime: 5 * 60 * 1000,
  })
}

export const useRoleById = (roleId: string | null) => {
  return useQuery({
    queryKey: [ROLE_KEY, roleId],
    queryFn: () => RoleAPI.getById(roleId!),
    enabled: !!roleId,
  })
}

export const usePermissionsList = () => {
  return useQuery({
    queryKey: [PERMISSION_KEY, 'list'],
    queryFn: () => PermissionAPI.getAll(),
    staleTime: 30 * 60 * 1000,
  })
}

export const useCreateRole = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) => RoleAPI.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [ROLE_KEY, 'list'] })
    },
  })
}

export const useUpdateRole = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: { id: string; data: { name?: string; description?: string } }) =>
      RoleAPI.update(params.id, params.data),
    onSuccess: (data) => {
      queryClient.setQueryData([ROLE_KEY, data.role.id], data.role)
      invalidateRolesAndUsers(queryClient)
      // The header shows the logged-in user's role name.
      if (isOwnRole(data.role.id)) void refreshSession()
    },
  })
}

export const useAssignPermissions = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: { id: string; permissionIds: string[] }) =>
      RoleAPI.assignPermissions(params.id, params.permissionIds),
    onSuccess: (data) => {
      queryClient.setQueryData([ROLE_KEY, data.role.id], data.role)
      invalidateRolesAndUsers(queryClient)
      // Editing your own role changes what you may do right now, not in the next session check.
      if (isOwnRole(data.role.id)) void refreshSession()
    },
  })
}

export const useDeleteRole = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (roleId: string) => RoleAPI.delete(roleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [ROLE_KEY, 'list'] })
    },
  })
}
