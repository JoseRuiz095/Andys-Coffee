import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DeliveriesAPI } from '../api/deliveries.api';
import { sileo } from 'sileo';
import { invalidateMoneyAndStockQueries } from '../../../shared/utils/queryInvalidation';
import { getErrorMessage } from '../../../shared/utils/errors';

const QUERY_KEY = 'pendingDeliveries';

export function usePendingDeliveries() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: () => DeliveriesAPI.getPendingDeliveries(),
  });
}

export function useHandoffDelivery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => DeliveriesAPI.handoffDelivery(orderId),
    onSuccess: () => {
      void invalidateMoneyAndStockQueries(queryClient);
      sileo.success({ title: 'Mandadito entregado', description: 'Se registró la entrega al repartidor.' });
    },
    onError: (error: unknown) => {
      sileo.error({
        title: 'Error',
        description: getErrorMessage(error, 'No se pudo registrar la entrega.'),
      });
    },
  });
}
