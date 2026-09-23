import { useQuery } from '@tanstack/react-query';
import { DashboardAPI } from '../api/dashboard.api';

export type PeriodType = 'today' | 'yesterday' | 'week' | 'month' | 'customRange';

export interface DashboardFilters {
  period?: PeriodType;
  from?: string;
  to?: string;
  cashRegisterId?: string;
  limit?: number;
  onlyLowStock?: boolean;
}

export function useDashboardSummary(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: ['dashboard', 'summary', filters],
    queryFn: () => DashboardAPI.getSummary({
      period: filters.period,
      from: filters.from,
      to: filters.to,
      cashRegisterId: filters.cashRegisterId,
    }),
  });
}

export function useDashboardSales(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: ['dashboard', 'sales', filters],
    queryFn: () => DashboardAPI.getSales({
      period: filters.period,
      from: filters.from,
      to: filters.to,
      limit: filters.limit || 5,
    }),
  });
}

export function useDashboardInventory(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: ['dashboard', 'inventory', filters],
    queryFn: () => DashboardAPI.getInventory({
      onlyLow: filters.onlyLowStock,
    }),
  });
}

export function useDashboardSalesTrend(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: ['dashboard', 'salesTrend', filters],
    queryFn: () => DashboardAPI.getSalesTrend({
      period: filters.period,
      from: filters.from,
      to: filters.to,
    }),
  });
}

export function useDashboardProductCosts(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: ['dashboard', 'productCosts', filters],
    queryFn: () => DashboardAPI.getProductCosts({
      period: filters.period,
      from: filters.from,
      to: filters.to,
      limit: filters.limit || 10,
    }),
  });
}

export function useDashboardCostEvolution(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: ['dashboard', 'costEvolution', filters],
    queryFn: () => DashboardAPI.getCostEvolution({
      period: filters.period,
      from: filters.from,
      to: filters.to,
    }),
  });
}

export function useDashboardExpensesByCategory(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: ['dashboard', 'expensesByCategory', filters],
    queryFn: () => DashboardAPI.getExpensesByCategory({
      period: filters.period,
      from: filters.from,
      to: filters.to,
    }),
  });
}

export function useDashboardUpcomingPurchases(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: ['dashboard', 'upcomingPurchases', filters],
    queryFn: () => DashboardAPI.getUpcomingPurchases({
      limit: filters.limit || 10,
    }),
  });
}

export function useDashboardRecentMovements(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: ['dashboard', 'recentMovements', filters],
    queryFn: () => DashboardAPI.getRecentInventoryMovements({
      limit: filters.limit || 20,
    }),
  });
}
