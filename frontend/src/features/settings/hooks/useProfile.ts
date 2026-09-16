import { useMutation } from '@tanstack/react-query'
import { changePassword, updateProfile } from '../../auth/services/auth.service'
import { authStore } from '../../auth/store/auth.store'

export const useChangePassword = () => {
  return useMutation({
    mutationFn: (params: { currentPassword: string; newPassword: string }) =>
      changePassword(params.currentPassword, params.newPassword),
  })
}

export const useUpdateProfile = () => {
  return useMutation({
    mutationFn: (name: string) => updateProfile(name),
    onSuccess: (data) => {
      const currentUser = authStore.getState().user
      if (currentUser) {
        authStore.setSession({ ...currentUser, name: data.user.name })
      }
    },
  })
}
