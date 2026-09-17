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
      period: filters.period as any,
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
      period: filters.period as any,
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

export function useDashboardCosts(filters: DashboardFilters = {}) {
  return useQuery({
    queryKey: ['dashboard', 'costs', filters],
    queryFn: () => DashboardAPI.getCosts({
      period: filters.period as any,
      from: filters.from,
      to: filters.to,
    }),
  });
}
