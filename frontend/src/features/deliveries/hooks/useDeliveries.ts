import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DeliveriesAPI } from '../api/deliveries.api';
import { sileo } from 'sileo';

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
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      sileo.success({ title: 'Mandadito entregado', description: 'Se registró la entrega al repartidor.' });
    },
    onError: (error: any) => {
      sileo.error({
        title: 'Error',
        description: error?.response?.data?.message ?? 'No se pudo registrar la entrega.',
      });
    },
  });
}
