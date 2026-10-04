import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';
import {
  getTodayInZone,
  addCalendarDays,
  getZonedDayBoundaries,
  getMonthRange,
} from '../utils/businessDate';
import { CASH_TIMEZONE } from '../config/app';
import { recognizedSaleOrderWhere } from '../utils/revenueRecognition';

interface DateRange {
  from: Date;
  to: Date;
}

type DashboardPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'customRange';

/** First and last business calendar day (YYYY-MM-DD, CASH_TIMEZONE) covered by a period. */
export function getPeriodDays(
  period: DashboardPeriod,
  customFrom?: string,
  customTo?: string,
): { firstDay: string; lastDay: string } {
  const today = getTodayInZone(CASH_TIMEZONE);

  switch (period) {
    case 'today':
      return { firstDay: today, lastDay: today };
    case 'yesterday': {
      const yesterday = addCalendarDays(today, -1);
      return { firstDay: yesterday, lastDay: yesterday };
    }
    case 'week':
      // Rolling window: today and the 6 previous days (the UI labels it "7 días").
      return { firstDay: addCalendarDays(today, -6), lastDay: today };
    case 'month': {
      const { monthStart, monthEnd } = getMonthRange(today.slice(0, 7)); // YYYY-MM
      return { firstDay: monthStart, lastDay: monthEnd };
    }
    case 'customRange': {
      if (!customFrom || !customTo) {
        throw new Error('customFrom and customTo required for customRange');
      }
      return { firstDay: customFrom, lastDay: customTo };
    }
    default:
      throw new Error(`Unknown period: ${period}`);
  }
}

/**
 * Converts a period string to a UTC date range using business timezone (America/Mexico_City)
 * This ensures Dashboard and IncomeStatement use the same business day definition
 */
export function getPeriodDateRange(
  period: DashboardPeriod,
  customFrom?: string,
  customTo?: string,
): DateRange {
  const { firstDay, lastDay } = getPeriodDays(period, customFrom, customTo);
  return {
    from: getZonedDayBoundaries(firstDay, CASH_TIMEZONE).start,
    to: getZonedDayBoundaries(lastDay, CASH_TIMEZONE).end,
  };
}

function toDecimal(value: Prisma.Decimal | number | string | null): Prisma.Decimal {
  if (value === null) return new Prisma.Decimal(0);
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(String(value));
}

export const dashboardRepository = {
  async countRecognizedOrders(from: Date, to: Date, cashRegisterId?: string) {
    return prisma.order.count({
      where: {
        ...recognizedSaleOrderWhere,
        createdAt: { gte: from, lt: to },
        ...(cashRegisterId && { cashSession: { cashRegisterId } }),
      },
    });
  },

  /** Active ingredients at or below their minimum, split so an out-of-stock one is not counted twice. */
  async getStockCounts() {
    const rows = await prisma.$queryRaw<Array<{ low: bigint; empty: bigint }>>`
      SELECT
        COUNT(*) FILTER (WHERE "currentStock" > 0 AND "currentStock" <= "minimumStock") as low,
        COUNT(*) FILTER (WHERE "currentStock" <= 0) as empty
      FROM ingredients
      WHERE "isActive" = true
    `;

    return {
      lowStockCount: Number(rows[0]?.low ?? 0),
      outOfStockCount: Number(rows[0]?.empty ?? 0),
    };
  },

  async getTopProducts(from: Date, to: Date, limit: number) {
    const topProducts = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          ...recognizedSaleOrderWhere,
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

    const products = await prisma.product.findMany({
      where: { id: { in: topProducts.map((p) => p.productId) } },
      select: { id: true, name: true },
    });

    const productMap = new Map(products.map((p) => [p.id, p.name]));

    return topProducts.map((p) => ({
      productId: p.productId,
      productName: productMap.get(p.productId) || 'Unknown',
      quantity: p._sum.quantity?.toNumber() || 0,
      revenue: p._sum.subtotal?.toNumber() || 0,
    }));
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
    const data = await prisma.$queryRaw<Array<{ date: string; ordersCount: bigint; revenue: Prisma.Decimal }>>`
      SELECT
        -- Business day (CASH_TIMEZONE), not the UTC day: late sales stay on their own day.
        -- Returned as text so no client shifts it to the previous day.
        to_char((o."createdAt" AT TIME ZONE ${CASH_TIMEZONE})::date, 'YYYY-MM-DD') as date,
        COUNT(DISTINCT o.id)::bigint as "ordersCount",
        COALESCE(SUM(p.amount), 0) as revenue
      FROM orders o
      LEFT JOIN payments p ON o.id = p."orderId" AND p.status = 'paid'
      WHERE o.status <> 'cancelled' AND o."createdAt" >= ${from} AND o."createdAt" < ${to}
        AND EXISTS (SELECT 1 FROM payments pp WHERE pp."orderId" = o.id AND pp.status = 'paid')
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    return data.map((row) => ({
      date: row.date,
      ordersCount: Number(row.ordersCount),
      revenue: toDecimal(row.revenue).toNumber(),
    }));
  },

  async getProductCosts(from: Date, to: Date, limit: number) {
    // A line's revenue and cost include its extras, like the income statement's COGS (L-06).
    const data = await prisma.$queryRaw<Array<{
      productId: string;
      quantity: Prisma.Decimal | number | string;
      revenue: Prisma.Decimal | number | string;
      cogs: Prisma.Decimal | number | string;
    }>>`
      SELECT
        oi."productId",
        SUM(oi.quantity) as quantity,
        SUM(oi.subtotal + COALESCE(ex.subtotal, 0)) as revenue,
        SUM(COALESCE(oi."costSnapshot", 0) + COALESCE(ex.cost, 0)) as cogs
      FROM order_items oi
      JOIN orders o ON oi."orderId" = o.id
      LEFT JOIN LATERAL (
        SELECT SUM(e.subtotal) as subtotal, SUM(COALESCE(e."costSnapshot", 0)) as cost
        FROM order_item_extras e
        WHERE e."orderItemId" = oi.id
      ) ex ON true
      WHERE o.status <> 'cancelled' AND o."createdAt" >= ${from} AND o."createdAt" < ${to}
        AND EXISTS (SELECT 1 FROM payments pp WHERE pp."orderId" = o.id AND pp.status = 'paid')
      GROUP BY oi."productId"
      ORDER BY 3 DESC
      LIMIT ${limit}
    `;

    const products = await prisma.product.findMany({
      where: { id: { in: data.map((p) => p.productId) } },
      select: { id: true, name: true },
    });

    const productMap = new Map(products.map((p) => [p.id, p.name]));

    return data.map((row) => {
      const cogs = toDecimal(row.cogs);
      const revenue = toDecimal(row.revenue);
      const marginPercent = revenue.greaterThan(0) ? revenue.minus(cogs).dividedBy(revenue).times(100).toNumber() : 0;

      return {
        productId: row.productId,
        productName: productMap.get(row.productId) || 'Unknown',
        quantity: toDecimal(row.quantity).toNumber(),
        revenue: revenue.toNumber(),
        cogs: cogs.toNumber(),
        marginPercent,
      };
    });
  },

  async getCostEvolution(from: Date, to: Date) {
    const data = await prisma.$queryRaw<Array<{ date: string; cogs: Prisma.Decimal | number | string; revenue: Prisma.Decimal | number | string }>>`
      SELECT
        -- Business day (CASH_TIMEZONE), not the UTC day: late sales stay on their own day.
        to_char((o."createdAt" AT TIME ZONE ${CASH_TIMEZONE})::date, 'YYYY-MM-DD') as date,
        COALESCE(SUM(COALESCE(oi."costSnapshot", 0) + COALESCE(ex.cost, 0)), 0) as cogs,
        COALESCE(SUM(oi.subtotal + COALESCE(ex.subtotal, 0)), 0) as revenue
      FROM order_items oi
      JOIN orders o ON oi."orderId" = o.id
      LEFT JOIN LATERAL (
        SELECT SUM(e.subtotal) as subtotal, SUM(COALESCE(e."costSnapshot", 0)) as cost
        FROM order_item_extras e
        WHERE e."orderItemId" = oi.id
      ) ex ON true
      WHERE o.status <> 'cancelled' AND o."createdAt" >= ${from} AND o."createdAt" < ${to}
        AND EXISTS (SELECT 1 FROM payments pp WHERE pp."orderId" = o.id AND pp.status = 'paid')
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    return data.map((row) => {
      const cogsDecimal = toDecimal(row.cogs);
      const revenueDecimal = toDecimal(row.revenue);
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
    const [data, purchases] = await Promise.all([
      prisma.expense.groupBy({
        by: ['category'],
        where: {
          expenseDate: { gte: from, lt: to },
        },
        _sum: {
          amount: true,
        },
      }),
      // Received purchases are expenses in the income statement (R-03), so they get their own bar.
      prisma.purchase.aggregate({
        where: { status: 'received', purchasedAt: { gte: from, lt: to } },
        _sum: { total: true },
      }),
    ]);

    const categories: Array<{ category: string; amount: number }> = data.map((row) => ({
      category: row.category,
      amount: toDecimal(row._sum.amount).toNumber(),
    }));

    const purchasesTotal = toDecimal(purchases._sum.total).toNumber();
    if (purchasesTotal > 0) {
      categories.push({ category: 'compras', amount: purchasesTotal });
    }

    return categories.sort((a, b) => b.amount - a.amount);
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
