import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../../app/api'
import { sileo } from 'sileo'

export interface CashSession {
  id: string
  openingAmount: number | string
  expectedAmount: number | string
  closingAmount?: number | string
  status: string
  openedAt: string
  closedAt?: string
  openedBy?: {
    id: string
    name: string
  }
  closedBy?: {
    id: string
    name: string
  }
}

export function useCashSessionHistory() {
  return useQuery({
    queryKey: ['cash-sessions-history'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ sessions: CashSession[] }>('/cash-register/sessions')
      return data.sessions || []
    },
  })
}

export function useCorrectCashClosing() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sessionId, closingAmount, comment }: { sessionId: string; closingAmount: number; comment?: string }) => {
      const { data } = await apiClient.patch<{ session: CashSession }>(
        `/cash-register/sessions/${sessionId}/closing`,
        { closingAmount, comment }
      )
      return data.session
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-sessions-history'] })
      sileo.success({ title: 'Cierre corregido', description: 'El cierre de caja ha sido actualizado' })
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Error al corregir el cierre'
      sileo.error({ title: 'Error', description: message })
    },
  })
}
