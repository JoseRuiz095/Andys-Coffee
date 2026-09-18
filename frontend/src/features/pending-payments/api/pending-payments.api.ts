import { apiClient } from '../../../app/api';

const BASE_URL = '/orders';

export interface PendingPayment {
  id: string;
  orderId: string;
  method: string;
  amount: string | number;
  status: string;
  reference: string | null;
  paidAt: string;
  createdAt: string;
  order: {
    orderNumber: string | number;
    customerName: string | null;
    total: string | number;
    createdAt: string;
  };
}

export type SettleMethod = 'cash' | 'transfer';

export const PendingPaymentsAPI = {
  async getPendingPayments() {
    const { data } = await apiClient.get<PendingPayment[]>(`${BASE_URL}/payments/pending`);
    return data;
  },

  async settlePayment(paymentId: string, method: SettleMethod) {
    const { data } = await apiClient.patch<PendingPayment>(`${BASE_URL}/payments/${paymentId}/settle`, { method });
    return data;
  },
};
