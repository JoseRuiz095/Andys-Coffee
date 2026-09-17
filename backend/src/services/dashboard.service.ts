import { dashboardRepository, getPeriodDateRange } from '../repositories/dashboard.repository';
import type { DashboardSummaryQuery, DashboardSalesQuery, DashboardInventoryQuery, DashboardCostsQuery } from '../validators/dashboard.validator';

export const dashboardService = {
  async getSummary(query: DashboardSummaryQuery) {
    const { from, to } = getPeriodDateRange(
      query.period,
      query.from,
      query.to,
    );

    const summary = await dashboardRepository.getSummary(from, to, query.cashRegisterId);

    return {
      period: query.period,
      from: from.toISOString(),
      to: to.toISOString(),
      ...summary,
    };
  },

  async getSales(query: DashboardSalesQuery) {
    const { from, to } = getPeriodDateRange(
      query.period,
      query.from,
      query.to,
    );

    const sales = await dashboardRepository.getSales(from, to, query.limit);

    return {
      period: query.period,
      from: from.toISOString(),
      to: to.toISOString(),
      ...sales,
    };
  },

  async getInventory(query?: DashboardInventoryQuery) {
    const inventory = await dashboardRepository.getInventory(query?.onlyLow ?? false);

    return {
      items: inventory,
      lowStockCount: inventory.filter((i) => i.isLow).length,
      outOfStockCount: inventory.filter((i) => i.isEmpty).length,
    };
  },

  async getCosts(query: DashboardCostsQuery) {
    const { from, to } = getPeriodDateRange(
      query.period,
      query.from,
      query.to,
    );

    const costs = await dashboardRepository.getCosts(from, to);

    return {
      period: query.period,
      from: from.toISOString(),
      to: to.toISOString(),
      ...costs,
    };
  },
};
