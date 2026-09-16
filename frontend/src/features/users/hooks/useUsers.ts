import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserAPI } from '../api/user.api'

const QUERY_KEY = 'users'

export interface UseUsersListParams {
  page?: number
  limit?: number
  search?: string
  isActive?: boolean
  roleId?: string
}

export const useUsersList = (params: UseUsersListParams = {}) => {
  return useQuery({
    queryKey: [QUERY_KEY, 'list', params],
    queryFn: () => UserAPI.getAll(params),
    staleTime: 2 * 60 * 1000,
  })
}

export const useUserById = (userId: string | null) => {
  return useQuery({
    queryKey: [QUERY_KEY, userId],
    queryFn: () => UserAPI.getById(userId!),
    enabled: !!userId,
  })
}

export const useCreateUser = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; email: string; password: string; roleId: string }) =>
      UserAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'list'] })
    },
  })
}

export const useUpdateUser = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: { id: string; data: { name?: string; email?: string; roleId?: string } }) =>
      UserAPI.update(params.id, params.data),
    onSuccess: (data) => {
      queryClient.setQueryData([QUERY_KEY, data.user.id], data.user)
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'list'] })
    },
  })
}

export const useSetUserActive = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: { id: string; isActive: boolean }) =>
      UserAPI.setActive(params.id, params.isActive),
    onSuccess: (data) => {
      queryClient.setQueryData([QUERY_KEY, data.user.id], data.user)
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'list'] })
    },
  })
}

export const useDeleteUser = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => UserAPI.delete(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'list'] })
    },
  })
}
