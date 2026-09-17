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

export interface SalesTrendData {
  period: string;
  from: string;
  to: string;
  data: Array<{
    date: string;
    ordersCount: number;
    revenue: number;
  }>;
}

export interface ProductCostsData {
  period: string;
  from: string;
  to: string;
  products: Array<{
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
    cogs: number;
    marginPercent: number;
  }>;
}

export interface CostEvolutionData {
  period: string;
  from: string;
  to: string;
  data: Array<{
    date: string;
    cogs: number;
    revenue: number;
    marginPercent: number;
  }>;
}

export interface ExpensesByCategoryData {
  period: string;
  from: string;
  to: string;
  categories: Array<{
    category: string;
    amount: number;
  }>;
}

export interface UpcomingPurchasesData {
  purchases: Array<{
    id: string;
    supplierName: string;
    total: number;
    itemCount: number;
    createdAt: string;
  }>;
  count: number;
}

export interface InventoryMovementData {
  id: string;
  ingredientName: string;
  type: string;
  quantity: number;
  createdAt: string;
  reason?: string;
}

export interface RecentMovementsData {
  movements: InventoryMovementData[];
  count: number;
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

  async getSalesTrend(params?: {
    period?: 'today' | 'yesterday' | 'week' | 'month' | 'customRange';
    from?: string;
    to?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.period) queryParams.set('period', params.period);
    if (params?.from) queryParams.set('from', params.from);
    if (params?.to) queryParams.set('to', params.to);

    const { data } = await apiClient.get<SalesTrendData>(
      `${BASE_URL}/sales-trend${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    );
    return data;
  },

  async getProductCosts(params?: {
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

    const { data } = await apiClient.get<ProductCostsData>(
      `${BASE_URL}/product-costs${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    );
    return data;
  },

  async getCostEvolution(params?: {
    period?: 'today' | 'yesterday' | 'week' | 'month' | 'customRange';
    from?: string;
    to?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.period) queryParams.set('period', params.period);
    if (params?.from) queryParams.set('from', params.from);
    if (params?.to) queryParams.set('to', params.to);

    const { data } = await apiClient.get<CostEvolutionData>(
      `${BASE_URL}/cost-evolution${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    );
    return data;
  },

  async getExpensesByCategory(params?: {
    period?: 'today' | 'yesterday' | 'week' | 'month' | 'customRange';
    from?: string;
    to?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.period) queryParams.set('period', params.period);
    if (params?.from) queryParams.set('from', params.from);
    if (params?.to) queryParams.set('to', params.to);

    const { data } = await apiClient.get<ExpensesByCategoryData>(
      `${BASE_URL}/expenses-by-category${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    );
    return data;
  },

  async getUpcomingPurchases(params?: { limit?: number }) {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set('limit', String(params.limit));

    const { data } = await apiClient.get<UpcomingPurchasesData>(
      `${BASE_URL}/upcoming-inventory${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    );
    return data;
  },

  async getRecentInventoryMovements(params?: { limit?: number }) {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set('limit', String(params.limit));

    const { data } = await apiClient.get<RecentMovementsData>(
      `${BASE_URL}/inventory-movements${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    );
    return data;
  },
};
