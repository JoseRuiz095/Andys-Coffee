import { apiClient } from '../../../app/api';
import { Order, PaginatedOrders } from '../types/orders.types';
import { OrderStatus } from '../types/backend.types';

export const getOrders = async (
  page = 1,
  limit = 10,
  status?: OrderStatus,
  search?: string
): Promise<PaginatedOrders> => {
  const { data } = await apiClient.get<PaginatedOrders>('/orders', {
    params: { page, limit, status, search },
  });
  return data;
};

export const getOrderById = async (id: string): Promise<Order> => {
  const { data } = await apiClient.get<Order>(`/orders/${id}`);
  return data;
};

export const updateOrderStatus = async (
  id: string,
  status: OrderStatus
): Promise<Order> => {
  const { data } = await apiClient.patch<Order>(`/orders/${id}/status`, {
    status,
  });
  return data;
};
