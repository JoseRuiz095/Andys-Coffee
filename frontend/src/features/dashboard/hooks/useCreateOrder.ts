import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createOrder } from '../services/order.service';
import type { CreateOrderPayload } from '../types/order.types';
import { invalidateMoneyAndStockQueries } from '../../../shared/utils/queryInvalidation';

export const useCreateOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (order: CreateOrderPayload) => createOrder(order),
    onSuccess: () => {
      void invalidateMoneyAndStockQueries(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};
