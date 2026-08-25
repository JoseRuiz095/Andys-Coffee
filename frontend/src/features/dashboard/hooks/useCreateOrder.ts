import { useMutation } from '@tanstack/react-query';
import { createOrder } from '../services/order.service';
import type { CreateOrderPayload } from '../types/order.types';

export const useCreateOrder = () => {
  return useMutation({
    mutationFn: (order: CreateOrderPayload) => createOrder(order),
    onSuccess: (data) => {
      // TODO: Invalidate queries or update state after successful order creation
      console.log('Order created successfully:', data);
    },
    onError: (error) => {
      // TODO: Handle error appropriately
      console.error('Error creating order:', (error as any).response?.data || error);
    },
  });
};
