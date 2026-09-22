import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sileo } from 'sileo';
import { invalidateMoneyAndStockQueries } from '../../../shared/utils/queryInvalidation';
import { DailyOrdersAPI } from '../api/daily-orders.api';
import { updateOrderStatus } from '../../orders/services/order.service';

const QUERY_KEY = 'dailyOrders';

export function useDailyOrders(date: string) {
  return useQuery({
    queryKey: [QUERY_KEY, date],
    queryFn: () => DailyOrdersAPI.getByDate(date),
  });
}

export function useCancelDailyOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => updateOrderStatus(orderId, 'cancelled'),
    onSuccess: () => {
      void invalidateMoneyAndStockQueries(queryClient);
      sileo.success({
        title: 'Orden cancelada',
        description: 'La orden fue cancelada correctamente.',
      });
    },
    onError: (error: any) => {
      sileo.error({
        title: 'Error',
        description: error?.response?.data?.message ?? 'No se pudo cancelar la orden.',
      });
    },
  });
}
