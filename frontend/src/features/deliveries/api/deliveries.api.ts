import { apiClient } from '../../../app/api';

const BASE_URL = '/orders';

export interface PendingDelivery {
  id: string;
  orderNumber: string | number;
  customerName: string | null;
  deliveryAmount: string | number;
  deliveryPaymentMethod: string | null;
  createdAt: string;
}

export const DeliveriesAPI = {
  async getPendingDeliveries() {
    const { data } = await apiClient.get<PendingDelivery[]>(`${BASE_URL}/deliveries/pending`);
    return data;
  },

  async handoffDelivery(orderId: string) {
    const { data } = await apiClient.patch(`${BASE_URL}/${orderId}/delivery/handoff`, {});
    return data;
  },
};
