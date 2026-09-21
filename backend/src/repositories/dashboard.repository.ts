import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';
import {
  getTodayInZone,
  addCalendarDays,
  getZonedDayBoundaries,
  getMonthRange,
  getWeekRange,
} from '../utils/businessDate';
import { CASH_TIMEZONE } from '../config/app';

interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Converts a period string to a UTC date range using business timezone (America/Mexico_City)
 * This ensures Dashboard and IncomeStatement use the same business day definition
 */
export function getPeriodDateRange(
  period: 'today' | 'yesterday' | 'week' | 'month' | 'customRange',
  customFrom?: string,
  customTo?: string,
): DateRange {
  const today = getTodayInZone(CASH_TIMEZONE);

  switch (period) {
    case 'today': {
      const { start, end } = getZonedDayBoundaries(today, CASH_TIMEZONE);
      return { from: start, to: end };
    }
    case 'yesterday': {
      const yesterday = addCalendarDays(today, -1);
      const { start, end } = getZonedDayBoundaries(yesterday, CASH_TIMEZONE);
      return { from: start, to: end };
    }
    case 'week': {
      const { weekStart, weekEnd } = getWeekRange(today);
      const startBoundary = getZonedDayBoundaries(weekStart, CASH_TIMEZONE);
      const endBoundary = getZonedDayBoundaries(weekEnd, CASH_TIMEZONE);
      return { from: startBoundary.start, to: endBoundary.end };
    }
    case 'month': {
      const { monthStart, monthEnd } = getMonthRange(today.slice(0, 7)); // YYYY-MM
      const startBoundary = getZonedDayBoundaries(monthStart, CASH_TIMEZONE);
      const endBoundary = getZonedDayBoundaries(monthEnd, CASH_TIMEZONE);
      return { from: startBoundary.start, to: endBoundary.end };
    }
    case 'customRange': {
      if (!customFrom || !customTo) {
        throw new Error('customFrom and customTo required for customRange');
      }
      const fromBoundary = getZonedDayBoundaries(customFrom, CASH_TIMEZONE);
      const toBoundary = getZonedDayBoundaries(customTo, CASH_TIMEZONE);
      return { from: fromBoundary.start, to: toBoundary.end };
    }
    default:
      throw new Error(`Unknown period: ${period}`);
  }
}

export const dashboardRepository = {
  async getSummary(from: Date, to: Date, cashRegisterId?: string) {
    const whereOrder: Prisma.OrderWhereInput = {
      status: 'completed',
      createdAt: { gte: from, lt: to },
      ...(cashRegisterId && { cashSession: { cashRegisterId } }),
    };

    const whereExpense: Prisma.ExpenseWhereInput = {
      expenseDate: { gte: from, lt: to },
      ...(cashRegisterId && { cashSession: { cashRegisterId } }),
    };

    const whereIngredient: Prisma.IngredientWhereInput = {
      isActive: true,
    };

    const [totalOrders, totalRevenue, totalExpenses, lowStockData, outOfStockCount] = await Promise.all([
      prisma.order.count({ where: whereOrder }),
      prisma.payment.aggregate({
        where: { status: 'paid', order: { status: 'completed', createdAt: { gte: from, lt: to } } },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: whereExpense,
        _sum: { amount: true },
      }),
      prisma.$queryRaw<Array<{ count: BigInt }>>`
        SELECT COUNT(*) as count FROM ingredients
        WHERE "isActive" = true AND "currentStock" <= "minimumStock"
      `,
      prisma.ingredient.count({
        where: {
          ...whereIngredient,
          currentStock: { lte: 0 },
        },
      }),
    ]);

    const lowStockCount = Number(lowStockData[0]?.count ?? 0);

    const revenue = totalRevenue._sum.amount || new Prisma.Decimal(0);
    const expenses = totalExpenses._sum.amount || new Prisma.Decimal(0);
    const profit = revenue.minus(expenses);

    return {
      ordersCount: totalOrders,
      revenue: revenue.toNumber(),
      expenses: expenses.toNumber(),
      profit: profit.toNumber(),
      lowStockProducts: lowStockCount,
      outOfStockProducts: outOfStockCount,
    };
  },

  async getSales(from: Date, to: Date, limit: number) {
    const orders = await prisma.order.findMany({
      where: {
        status: 'completed',
        createdAt: { gte: from, lt: to },
      },
      select: {
        createdAt: true,
        total: true,
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const topProducts = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          status: 'completed',
          createdAt: { gte: from, lt: to },
        },
      },
      _sum: {
        quantity: true,
        subtotal: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: limit,
    });

    const productIds = topProducts.map((p) => p.productId).filter((id) => id !== null);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });

    const productMap = new Map(products.map((p) => [p.id, p.name]));

    const topProductsWithNames = topProducts
      .map((p) => ({
        productId: p.productId,
        productName: productMap.get(p.productId) || 'Unknown',
        quantity: p._sum.quantity?.toNumber() || 0,
        revenue: p._sum.subtotal?.toNumber() || 0,
      }))
      .slice(0, limit);

    return { orders, topProducts: topProductsWithNames };
  },

  async getInventory(onlyLow: boolean = false) {
    let ingredients;

    if (onlyLow) {
      ingredients = await prisma.$queryRaw<Array<{
        id: string;
        name: string;
        currentStock: Prisma.Decimal;
        minimumStock: Prisma.Decimal;
        abbreviation: string;
      }>>`
        SELECT i.id, i.name, i."currentStock", i."minimumStock", iu.abbreviation
        FROM ingredients i
        JOIN inventory_units iu ON i."unitId" = iu.id
        WHERE i."isActive" = true AND i."currentStock" <= i."minimumStock"
        ORDER BY i."currentStock" ASC
        LIMIT 100
      `;
    } else {
      ingredients = await prisma.$queryRaw<Array<{
        id: string;
        name: string;
        currentStock: Prisma.Decimal;
        minimumStock: Prisma.Decimal;
        abbreviation: string;
      }>>`
        SELECT i.id, i.name, i."currentStock", i."minimumStock", iu.abbreviation
        FROM ingredients i
        JOIN inventory_units iu ON i."unitId" = iu.id
        WHERE i."isActive" = true
        ORDER BY i."currentStock" ASC
        LIMIT 100
      `;
    }

    return ingredients.map((ing) => {
      const currentStock = new Prisma.Decimal(ing.currentStock.toString());
      const minimumStock = new Prisma.Decimal(ing.minimumStock.toString());
      return {
        id: ing.id,
        name: ing.name,
        stock: currentStock.toNumber(),
        minimum: minimumStock.toNumber(),
        unit: ing.abbreviation,
        isLow: currentStock.lessThanOrEqualTo(minimumStock),
        isEmpty: currentStock.lessThanOrEqualTo(0),
      };
    });
  },

  async getSalesTrend(from: Date, to: Date) {
    const data = await prisma.$queryRaw<Array<{ date: Date; ordersCount: bigint; revenue: Prisma.Decimal }>>`
      SELECT
        DATE_TRUNC('day', o."createdAt")::date as date,
        COUNT(DISTINCT o.id)::bigint as "ordersCount",
        COALESCE(SUM(p.amount), 0) as revenue
      FROM orders o
      LEFT JOIN payments p ON o.id = p."orderId" AND p.status = 'paid'
      WHERE o.status = 'completed' AND o."createdAt" >= ${from} AND o."createdAt" < ${to}
      GROUP BY DATE_TRUNC('day', o."createdAt")
      ORDER BY date ASC
    `;

    return data.map((row) => ({
      date: row.date,
      ordersCount: Number(row.ordersCount),
      revenue: row.revenue instanceof Prisma.Decimal ? row.revenue.toNumber() : Number(row.revenue),
    }));
  },

  async getProductCosts(from: Date, to: Date, limit: number) {
    const data = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          status: 'completed',
          createdAt: { gte: from, lt: to },
        },
      },
      _sum: {
        costSnapshot: true,
        subtotal: true,
        quantity: true,
      },
      orderBy: {
        _sum: {
          subtotal: 'desc',
        },
      },
      take: limit,
    });

    const productIds = data.map((p) => p.productId).filter((id) => id !== null);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });

    const productMap = new Map(products.map((p) => [p.id, p.name]));

    return data.map((row) => {
      const cogs = row._sum.costSnapshot || new Prisma.Decimal(0);
      const revenue = row._sum.subtotal || new Prisma.Decimal(0);
      const marginPercent = revenue.greaterThan(0) ? revenue.minus(cogs).dividedBy(revenue).times(100).toNumber() : 0;

      return {
        productId: row.productId,
        productName: productMap.get(row.productId) || 'Unknown',
        quantity: row._sum.quantity?.toNumber() || 0,
        revenue: revenue.toNumber(),
        cogs: cogs.toNumber(),
        marginPercent,
      };
    });
  },

  async getCostEvolution(from: Date, to: Date) {
    const data = await prisma.$queryRaw<Array<{ date: Date; cogs: Prisma.Decimal | number | string; revenue: Prisma.Decimal | number | string }>>`
      SELECT
        DATE_TRUNC('day', o."createdAt")::date as date,
        COALESCE(SUM(oi."costSnapshot"), 0) as cogs,
        COALESCE(SUM(oi.subtotal), 0) as revenue
      FROM order_items oi
      JOIN orders o ON oi."orderId" = o.id
      WHERE o.status = 'completed' AND o."createdAt" >= ${from} AND o."createdAt" < ${to}
      GROUP BY DATE_TRUNC('day', o."createdAt")
      ORDER BY date ASC
    `;

    return data.map((row) => {
      const cogsDecimal = row.cogs instanceof Prisma.Decimal ? row.cogs : new Prisma.Decimal(String(row.cogs));
      const revenueDecimal = row.revenue instanceof Prisma.Decimal ? row.revenue : new Prisma.Decimal(String(row.revenue));
      const marginPercent = revenueDecimal.greaterThan(0)
        ? revenueDecimal.minus(cogsDecimal).dividedBy(revenueDecimal).times(100).toNumber()
        : 0;

      return {
        date: row.date,
        cogs: cogsDecimal.toNumber(),
        revenue: revenueDecimal.toNumber(),
        marginPercent,
      };
    });
  },

  async getExpensesByCategory(from: Date, to: Date) {
    const data = await prisma.expense.groupBy({
      by: ['category'],
      where: {
        expenseDate: { gte: from, lt: to },
      },
      _sum: {
        amount: true,
      },
      orderBy: {
        _sum: {
          amount: 'desc',
        },
      },
    });

    return data.map((row) => ({
      category: row.category,
      amount: (row._sum.amount || new Prisma.Decimal(0)).toNumber(),
    }));
  },

  async getUpcomingPurchases(limit: number) {
    const purchases = await prisma.purchase.findMany({
      where: {
        status: 'draft',
      },
      include: {
        supplier: {
          select: { id: true, name: true },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            unitCost: true,
            ingredient: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return purchases.map((p) => ({
      id: p.id,
      supplierName: p.supplier?.name || 'Sin proveedor',
      total: p.total.toNumber(),
      itemCount: p.items.length,
      createdAt: p.createdAt,
    }));
  },

  async getRecentInventoryMovements(limit: number) {
    const movements = await prisma.inventoryMovement.findMany({
      include: {
        ingredient: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return movements.map((m) => ({
      id: m.id,
      ingredientName: m.ingredient.name,
      type: m.type,
      quantity: m.quantity.toNumber(),
      createdAt: m.createdAt,
      reason: m.reason,
    }));
  },
};
