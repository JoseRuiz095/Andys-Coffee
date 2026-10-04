import { dashboardRepository, getPeriodDateRange, getPeriodDays } from '../repositories/dashboard.repository';
import { incomeStatementService } from './income-statement.service';
import { addCalendarDays, getTodayInZone } from '../utils/businessDate';
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

type DashboardPeriod = DashboardSummaryQuery['period'];

/** Business days of the period up to today (a chart never plots days that have not happened). */
function listElapsedDays(period: DashboardPeriod, from?: string, to?: string): string[] {
  const { firstDay, lastDay } = getPeriodDays(period, from, to);
  const today = getTodayInZone();
  const end = lastDay < today ? lastDay : today;

  const days: string[] = [];
  for (let cursor = firstDay; cursor <= end; cursor = addCalendarDays(cursor, 1)) {
    days.push(cursor);
  }
  return days;
}

/** One row per day: days without sales get an explicit zero row instead of being skipped. */
function fillMissingDays<T extends { date: string }>(days: string[], rows: T[], empty: (date: string) => T): T[] {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  return days.map((date) => byDate.get(date) ?? empty(date));
}

export const dashboardService = {
  async getSummary(query: DashboardSummaryQuery) {
    const { from, to } = getPeriodDateRange(
      query.period,
      query.from,
      query.to,
    );

    // Money figures come from the income statement, so both screens always agree
    // (frozen snapshots, received purchases counted as expenses, fixed operating expenses).
    const days = listElapsedDays(query.period, query.from, query.to);
    const [ordersCount, stock, totals] = await Promise.all([
      dashboardRepository.countRecognizedOrders(from, to, query.cashRegisterId),
      dashboardRepository.getStockCounts(),
      days.length > 0
        ? incomeStatementService.getRangeTotals(days[0], days[days.length - 1], query.cashRegisterId)
        : null,
    ]);

    return {
      period: query.period,
      from: from.toISOString(),
      to: to.toISOString(),
      ordersCount,
      revenue: totals?.ingresosTotales ?? 0,
      expenses: totals?.gastos ?? 0,
      profit: totals?.gananciaNeta ?? 0,
      fixedExpenses: totals?.gastosOperativosFijos ?? 0,
      distributableProfit: totals?.gananciaDistribuible ?? 0,
      lowStockProducts: stock.lowStockCount,
      outOfStockProducts: stock.outOfStockCount,
    };
  },

  async getSales(query: DashboardSalesQuery) {
    const { from, to } = getPeriodDateRange(
      query.period,
      query.from,
      query.to,
    );

    const topProducts = await dashboardRepository.getTopProducts(from, to, query.limit);

    return {
      period: query.period,
      from: from.toISOString(),
      to: to.toISOString(),
      topProducts,
    };
  },

  async getInventory(query?: DashboardInventoryQuery) {
    const [inventory, stock] = await Promise.all([
      dashboardRepository.getInventory(query?.onlyLow ?? false),
      dashboardRepository.getStockCounts(),
    ]);

    return {
      items: inventory,
      ...stock,
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
      data: fillMissingDays(listElapsedDays(query.period, query.from, query.to), trend, (date) => ({
        date,
        ordersCount: 0,
        revenue: 0,
      })),
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
      data: fillMissingDays(listElapsedDays(query.period, query.from, query.to), evolution, (date) => ({
        date,
        cogs: 0,
        revenue: 0,
        marginPercent: 0,
      })),
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
