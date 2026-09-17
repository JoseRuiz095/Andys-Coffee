import { dashboardRepository, getPeriodDateRange } from '../repositories/dashboard.repository';
import type {
  DashboardSummaryQuery,
  DashboardSalesQuery,
  DashboardInventoryQuery,
  DashboardSalesTrendQuery,
  DashboardProductCostsQuery,
  DashboardCostEvolutionQuery,
  DashboardExpensesByCategoryQuery,
  DashboardUpcomingPurchasesQuery,
  DashboardRecentMovementsQuery,
} from '../validators/dashboard.validator';

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

  async getSalesTrend(query: DashboardSalesTrendQuery) {
    const { from, to } = getPeriodDateRange(
      query.period,
      query.from,
      query.to,
    );

    const trend = await dashboardRepository.getSalesTrend(from, to);

    return {
      period: query.period,
      from: from.toISOString(),
      to: to.toISOString(),
      data: trend,
    };
  },

  async getProductCosts(query: DashboardProductCostsQuery) {
    const { from, to } = getPeriodDateRange(
      query.period,
      query.from,
      query.to,
    );

    const data = await dashboardRepository.getProductCosts(from, to, query.limit);

    return {
      period: query.period,
      from: from.toISOString(),
      to: to.toISOString(),
      products: data,
    };
  },

  async getCostEvolution(query: DashboardCostEvolutionQuery) {
    const { from, to } = getPeriodDateRange(
      query.period,
      query.from,
      query.to,
    );

    const evolution = await dashboardRepository.getCostEvolution(from, to);

    return {
      period: query.period,
      from: from.toISOString(),
      to: to.toISOString(),
      data: evolution,
    };
  },

  async getExpensesByCategory(query: DashboardExpensesByCategoryQuery) {
    const { from, to } = getPeriodDateRange(
      query.period,
      query.from,
      query.to,
    );

    const expenses = await dashboardRepository.getExpensesByCategory(from, to);

    return {
      period: query.period,
      from: from.toISOString(),
      to: to.toISOString(),
      categories: expenses,
    };
  },

  async getUpcomingPurchases(query?: DashboardUpcomingPurchasesQuery) {
    const purchases = await dashboardRepository.getUpcomingPurchases(query?.limit ?? 10);

    return {
      purchases,
      count: purchases.length,
    };
  },

  async getRecentInventoryMovements(query?: DashboardRecentMovementsQuery) {
    const movements = await dashboardRepository.getRecentInventoryMovements(query?.limit ?? 20);

    return {
      movements,
      count: movements.length,
    };
  },
};
