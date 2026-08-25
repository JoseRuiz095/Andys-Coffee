import { apiClient } from '@/app/api';
import type { CreateOrderPayload, Order } from '../types/order.types';

export const createOrder = async (order: CreateOrderPayload): Promise<Order> => {
  const response = await apiClient.post<Order>('/orders', order);
  return response.data;
};
