import { apiClient } from '../../../app/api';
import { Order, PaginatedOrders, type CancellationRequestSummary, type PendingCancellationRequest } from '../types/orders.types';
import type { CreateOrderItem, CreateOrderPayload, OrderQuote } from '../../dashboard/types/order.types';
import { OrderStatus } from '../types/backend.types';

export const getOrders = async (
  page = 1,
  limit = 10,
  status?: OrderStatus,
  search?: string
): Promise<PaginatedOrders> => {
  const { data } = await apiClient.get<PaginatedOrders>('/orders', {
    // board: open orders of any day + today's orders (older finished ones are in "Órdenes del día").
    params: { page, limit, status, search, board: true },
  });
  return data;
};

export const getOrderById = async (id: string): Promise<Order> => {
  const { data } = await apiClient.get<Order>(`/orders/${id}`);
  return data;
};

export const updateOrderStatus = async (
  id: string,
  status: OrderStatus,
  reason?: string
): Promise<Order> => {
  const { data } = await apiClient.patch<Order>(`/orders/${id}/status`, {
    status,
    ...(reason && { reason }),
  });
  return data;
};

/** Asks an admin to approve cancelling a completed sale (approved at once for an approver). */
export const requestOrderCancellation = async (orderId: string, reason: string): Promise<CancellationRequestSummary> => {
  const { data } = await apiClient.post<CancellationRequestSummary>(`/orders/${orderId}/cancellation-requests`, { reason });
  return data;
};

export const getPendingCancellationRequests = async (): Promise<PendingCancellationRequest[]> => {
  const { data } = await apiClient.get<PendingCancellationRequest[]>('/orders/cancellation-requests');
  return data;
};

export const reviewOrderCancellation = async (
  requestId: string,
  decision: 'approve' | 'reject',
  comment?: string,
): Promise<CancellationRequestSummary> => {
  const { data } = await apiClient.patch<CancellationRequestSummary>(
    `/orders/cancellation-requests/${requestId}/${decision}`,
    comment ? { comment } : {},
  );
  return data;
};

// --- POS: price and create a sale ---

/**
 * `idempotencyKey` identifies the sale attempt, not the HTTP call: retrying the same cart with
 * the same key returns the order the server already created instead of charging twice.
 */
export const createOrder = async (order: CreateOrderPayload, idempotencyKey: string): Promise<Order> => {
  const response = await apiClient.post<Order>('/orders', order, {
    headers: { 'X-Idempotency-Key': idempotencyKey },
  });
  return response.data;
};

/** Prices the cart with the same rules as the sale; creates nothing. */
export const quoteOrder = async (items: CreateOrderItem[]): Promise<OrderQuote> => {
  const response = await apiClient.post<OrderQuote>('/orders/quote', { items });
  return response.data;
};
