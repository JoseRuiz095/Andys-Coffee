import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createOrder } from '../services/order.service';
import type { CreateOrderPayload } from '../types/order.types';

export const useCreateOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (order: CreateOrderPayload) => createOrder(order),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['cash-session', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};
