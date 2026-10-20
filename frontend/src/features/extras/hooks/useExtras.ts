import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sileo } from 'sileo'
import { getErrorMessage } from '../../../shared/utils/errors'
import { menuQueryKey } from '../../menu/hooks/useMenu'
import { ExtraAPI } from '../api/extra.api'
import type { ExtraInput } from '../types/extra.types'

export const extrasQueryKey = ['extras'] as const

export function useExtras(enabled = true) {
  return useQuery({ queryKey: extrasQueryKey, queryFn: ExtraAPI.getAll, enabled })
}

/** Create, edit, (de)activate and delete extras; the POS menu is refreshed after each change. */
export function useExtraMutations() {
  const queryClient = useQueryClient()
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: extrasQueryKey })
    void queryClient.invalidateQueries({ queryKey: menuQueryKey })
  }
  const onError = (title: string) => (error: unknown) =>
    sileo.error({ title, description: getErrorMessage(error, 'Inténtalo de nuevo.') })

  const save = useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ExtraInput }) => (id ? ExtraAPI.update(id, input) : ExtraAPI.create(input)),
    onSuccess: (_extra, { id }) => {
      refresh()
      sileo.success({ title: id ? 'Extra actualizado' : 'Extra creado' })
    },
    onError: onError('No se pudo guardar el extra'),
  })

  const setActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => ExtraAPI.setActive(id, isActive),
    onSuccess: refresh,
    onError: onError('No se pudo cambiar el estado del extra'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => ExtraAPI.delete(id),
    onSuccess: () => {
      refresh()
      sileo.success({ title: 'Extra eliminado' })
    },
    onError: onError('No se pudo eliminar el extra'),
  })

  return { save, setActive, remove }
}

export function useSetProductExtras() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, extraIds }: { productId: string; extraIds: string[] }) => ExtraAPI.setProductExtras(productId, extraIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: extrasQueryKey })
      void queryClient.invalidateQueries({ queryKey: menuQueryKey })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}
