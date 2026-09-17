import { apiClient } from '../../../app/api';

const BASE_URL = '/dashboard';

export interface DashboardSummary {
  period: string;
  from: string;
  to: string;
  ordersCount: number;
  revenue: number;
  expenses: number;
  profit: number;
  lowStockProducts: number;
  outOfStockProducts: number;
}

export interface SalesData {
  period: string;
  from: string;
  to: string;
  orders: Array<{
    createdAt: string;
    total: number;
    _count: { items: number };
  }>;
  topProducts: Array<{
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
  }>;
}

export interface InventoryItem {
  id: string;
  name: string;
  stock: number;
  minimum: number;
  unit: string;
  isLow: boolean;
  isEmpty: boolean;
}

export interface InventoryData {
  items: InventoryItem[];
  lowStockCount: number;
  outOfStockCount: number;
}

export interface CostsData {
  period: string;
  from: string;
  to: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPercent: number;
  expenses: number;
  netProfit: number;
  netMarginPercent: number;
}

export const DashboardAPI = {
  async getSummary(params?: {
    period?: 'today' | 'yesterday' | 'week' | 'month' | 'customRange';
    from?: string;
    to?: string;
    cashRegisterId?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.period) queryParams.set('period', params.period);
    if (params?.from) queryParams.set('from', params.from);
    if (params?.to) queryParams.set('to', params.to);
    if (params?.cashRegisterId) queryParams.set('cashRegisterId', params.cashRegisterId);

    const { data } = await apiClient.get<DashboardSummary>(
      `${BASE_URL}/summary${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    );
    return data;
  },

  async getSales(params?: {
    period?: 'today' | 'yesterday' | 'week' | 'month' | 'customRange';
    from?: string;
    to?: string;
    limit?: number;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.period) queryParams.set('period', params.period);
    if (params?.from) queryParams.set('from', params.from);
    if (params?.to) queryParams.set('to', params.to);
    if (params?.limit) queryParams.set('limit', String(params.limit));

    const { data } = await apiClient.get<SalesData>(
      `${BASE_URL}/sales${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    );
    return data;
  },

  async getInventory(params?: { onlyLow?: boolean }) {
    const queryParams = new URLSearchParams();
    if (params?.onlyLow !== undefined) queryParams.set('onlyLow', String(params.onlyLow));

    const { data } = await apiClient.get<InventoryData>(
      `${BASE_URL}/inventory${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    );
    return data;
  },

  async getCosts(params?: {
    period?: 'today' | 'yesterday' | 'week' | 'month' | 'customRange';
    from?: string;
    to?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.period) queryParams.set('period', params.period);
    if (params?.from) queryParams.set('from', params.from);
    if (params?.to) queryParams.set('to', params.to);

    const { data } = await apiClient.get<CostsData>(
      `${BASE_URL}/costs${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    );
    return data;
  },
};
