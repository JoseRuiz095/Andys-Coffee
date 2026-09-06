import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createOrder } from '../services/order.service';
import type { CreateOrderPayload } from '../types/order.types';

export const useCreateOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (order: CreateOrderPayload) => createOrder(order),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cash-session', 'active'] });
      console.log('Order created successfully:', data);
    },
    onError: (error) => {
      console.error('Error creating order:', error instanceof Error ? error.message : error);
    },
  });
};
