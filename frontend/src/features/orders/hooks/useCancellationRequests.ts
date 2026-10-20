import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sileo } from 'sileo'
import { getErrorMessage } from '../../../shared/utils/errors'
import { invalidateMoneyAndStockQueries } from '../../../shared/utils/queryInvalidation'
import {
  getPendingCancellationRequests,
  requestOrderCancellation,
  reviewOrderCancellation,
} from '../services/order.service'

export const cancellationRequestsQueryKey = ['cancellationRequests'] as const

/** Pending requests for an approver. Polls so new requests show up without reloading. */
export function usePendingCancellationRequests(enabled: boolean) {
  return useQuery({
    queryKey: cancellationRequestsQueryKey,
    queryFn: getPendingCancellationRequests,
    enabled,
    refetchInterval: enabled ? 30_000 : false,
  })
}

/** A cashier asks to cancel a completed sale (an approver's own request is approved at once). */
export function useRequestOrderCancellation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) => requestOrderCancellation(orderId, reason),
    onSuccess: (request) => {
      void invalidateMoneyAndStockQueries(queryClient)
      void queryClient.invalidateQueries({ queryKey: cancellationRequestsQueryKey })
      if (request.status === 'approved') {
        sileo.success({ title: 'Venta cancelada', description: 'Se devolvió el cobro de la venta.' })
      } else {
        sileo.success({ title: 'Solicitud enviada', description: 'Un administrador debe aprobar la cancelación.' })
      }
    },
    onError: (error: unknown) => {
      sileo.error({ title: 'No se pudo solicitar', description: getErrorMessage(error, 'Inténtalo de nuevo.') })
    },
  })
}

export function useReviewOrderCancellation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ requestId, decision, comment }: { requestId: string; decision: 'approve' | 'reject'; comment?: string }) =>
      reviewOrderCancellation(requestId, decision, comment),
    onSuccess: (request) => {
      void invalidateMoneyAndStockQueries(queryClient)
      void queryClient.invalidateQueries({ queryKey: cancellationRequestsQueryKey })
      sileo.success({
        title: request.status === 'approved' ? 'Cancelación aprobada' : 'Cancelación rechazada',
        description: request.status === 'approved' ? 'La venta se canceló y se devolvió su cobro.' : 'La venta sigue completada.',
      })
    },
    onError: (error: unknown) => {
      sileo.error({ title: 'No se pudo revisar la solicitud', description: getErrorMessage(error, 'Inténtalo de nuevo.') })
    },
  })
}
