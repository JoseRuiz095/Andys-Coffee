import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../../app/api'
import { sileo } from 'sileo'
import { getErrorMessage } from '../../../shared/utils/errors'
import { invalidateMoneyAndStockQueries } from '../../../shared/utils/queryInvalidation'

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
      // The corrected count changes the cash difference reported for that day too.
      void invalidateMoneyAndStockQueries(queryClient)
      sileo.success({ title: 'Cierre corregido', description: 'El cierre de caja ha sido actualizado' })
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error, 'Error al corregir el cierre')
      sileo.error({ title: 'Error', description: message })
    },
  })
}

/**
 * Reopens a closed cut (POST /cash-register/sessions/:id/reopen, needs cash.correct). The
 * discarded count is kept in the audit log by the backend; the drawer becomes "open" again.
 */
export function useReopenCashSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sessionId, reason }: { sessionId: string; reason: string }) => {
      const { data } = await apiClient.post<{ session: CashSession }>(`/cash-register/sessions/${sessionId}/reopen`, { reason })
      return data.session
    },
    onSuccess: () => {
      void invalidateMoneyAndStockQueries(queryClient)
      sileo.success({ title: 'Caja reabierta', description: 'El corte se descartó y la caja vuelve a estar abierta.' })
    },
    onError: (error: unknown) => {
      sileo.error({ title: 'No se pudo reabrir la caja', description: getErrorMessage(error, 'Inténtalo de nuevo.') })
    },
  })
}
