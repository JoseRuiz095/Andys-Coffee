import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Converts a period string to a UTC date range
 * Period is always interpreted as local business day (not timezone-converted)
 */
export function getPeriodDateRange(
  period: 'today' | 'yesterday' | 'week' | 'month' | 'customRange',
  customFrom?: string,
  customTo?: string,
): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case 'today': {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return { from: today, to: tomorrow };
    }
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { from: yesterday, to: today };
    }
    case 'week': {
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return { from: sevenDaysAgo, to: tomorrow };
    }
    case 'month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { from: monthStart, to: monthEnd };
    }
    case 'customRange': {
      if (!customFrom || !customTo) {
        throw new Error('customFrom and customTo required for customRange');
      }
      const from = new Date(`${customFrom}T00:00:00Z`);
      const to = new Date(`${customTo}T23:59:59.999Z`);
      return { from, to };
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

  async getCosts(from: Date, to: Date) {
    const completedOrders = await prisma.orderItem.aggregate({
      where: {
        order: {
          status: 'completed',
          createdAt: { gte: from, lt: to },
        },
      },
      _sum: {
        costSnapshot: true,
        subtotal: true,
      },
    });

    const expenses = await prisma.expense.aggregate({
      where: {
        expenseDate: { gte: from, lt: to },
      },
      _sum: {
        amount: true,
      },
    });

    const cogs = completedOrders._sum.costSnapshot || new Prisma.Decimal(0);
    const revenue = completedOrders._sum.subtotal || new Prisma.Decimal(0);
    const expensesAmount = expenses._sum.amount || new Prisma.Decimal(0);

    const grossProfit = revenue.minus(cogs);
    const netProfit = grossProfit.minus(expensesAmount);

    const grossMarginPercent = revenue.greaterThan(0) ? grossProfit.dividedBy(revenue).times(100).toNumber() : 0;
    const netMarginPercent = revenue.greaterThan(0) ? netProfit.dividedBy(revenue).times(100).toNumber() : 0;

    return {
      revenue: revenue.toNumber(),
      cogs: cogs.toNumber(),
      grossProfit: grossProfit.toNumber(),
      grossMarginPercent,
      expenses: expensesAmount.toNumber(),
      netProfit: netProfit.toNumber(),
      netMarginPercent,
    };
  },
};
