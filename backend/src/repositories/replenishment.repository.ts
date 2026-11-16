import { prisma } from '../config/prisma';

/** Movement types that make up consumption: sales, their reversals, and exits (waste, etc.). */
const CONSUMPTION_TYPES = ['sale', 'sale_reversal', 'exit'];

export const ReplenishmentRepository = {
  async findActiveIngredients() {
    return prisma.ingredient.findMany({
      where: { isActive: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        minimumStock: true,
        maximumStock: true,
        averageCost: true,
        unit: { select: { abbreviation: true } },
      },
      orderBy: { name: 'asc' },
    });
  },

  /** Net quantity per ingredient of consumption movements since `since` (negative = consumed). */
  async sumConsumptionSince(since: Date) {
    const rows = await prisma.inventoryMovement.groupBy({
      by: ['ingredientId'],
      where: { type: { in: CONSUMPTION_TYPES }, createdAt: { gte: since } },
      _sum: { quantity: true },
    });
    return new Map(rows.map((row) => [row.ingredientId, row._sum.quantity]));
  },

  /** Latest received purchase line per ingredient: who sold it and at what unit cost. */
  async findLastPurchases(ingredientIds: string[]) {
    const items = await prisma.purchaseItem.findMany({
      where: { ingredientId: { in: ingredientIds }, purchase: { status: 'received' } },
      orderBy: { purchase: { purchasedAt: 'desc' } },
      distinct: ['ingredientId'],
      select: {
        ingredientId: true,
        unitCost: true,
        purchase: { select: { purchasedAt: true, supplier: { select: { id: true, name: true } } } },
      },
    });
    return new Map(items.map((item) => [item.ingredientId, item]));
  },
};
