import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../../app/api'
import { sileo } from 'sileo'
import { getErrorMessage } from '../../../shared/utils/errors'

export interface CashSession {
  id: string
  openingAmount: number | string
  expectedAmount: number | string
  closingAmount?: number | string
  closingReason?: string | null
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

export function useCashSessionHistory(filters: { page?: number; limit?: number; startDate?: string; endDate?: string; cashRegisterId?: string; status?: string } = {}) {
  return useQuery({
    queryKey: ['cash-sessions-history', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') params.set(key, String(value))
      })
      const { data } = await apiClient.get<{ data: CashSession[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/cash-register/sessions?${params.toString()}`)
      return data
    },
  })
}

export function useCorrectCashClosing() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sessionId, correctedAmount, reason, comment }: { sessionId: string; correctedAmount: number; reason: string; comment?: string }) => {
      const { data } = await apiClient.patch<{ session: CashSession }>(
        `/cash-register/sessions/${sessionId}/closing`,
        { correctedAmount, reason, comment }
      )
      return data.session
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-sessions-history'] })
      sileo.success({ title: 'Cierre corregido', description: 'El cierre de caja ha sido actualizado' })
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error, 'Error al corregir el cierre')
      sileo.error({ title: 'Error', description: message })
    },
  })
}
