import { apiClient } from '../../../app/api';
import { DailyOrder } from '../types/daily-orders.types';

export const DailyOrdersAPI = {
  async getByDate(date: string) {
    const { data } = await apiClient.get<DailyOrder[]>('/orders/by-date', { params: { date } });
    return data;
  },
};
