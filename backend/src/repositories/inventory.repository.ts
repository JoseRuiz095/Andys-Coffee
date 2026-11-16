import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';
import { paginationMeta, paginationOffset } from '../utils/pagination';

type PrismaClient = Prisma.TransactionClient | typeof prisma;

export const InventoryRepository = {
  async findById(id: string) {
    return prisma.ingredient.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        minimumStock: true,
        maximumStock: true,
        averageCost: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        unit: {
          select: {
            id: true,
            name: true,
            abbreviation: true,
          },
        },
        movements: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            quantity: true,
            unitCost: true,
            createdAt: true,
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        recipes: {
          select: {
            productId: true,
            quantity: true,
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
      },
    });
  },

  async findBySku(sku: string) {
    return prisma.ingredient.findFirst({
      where: { sku, deletedAt: null },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        minimumStock: true,
        maximumStock: true,
        averageCost: true,
        isActive: true,
        unit: {
          select: {
            id: true,
            name: true,
            abbreviation: true,
          },
        },
      },
    });
  },

  async findByNameNormalized(name: string) {
    // Búsqueda exacta por nombre normalizado (case-insensitive, trimmed)
    // Útil para detectar duplicados antes de crear
    return prisma.ingredient.findFirst({
      where: {
        isActive: true,
        deletedAt: null,
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        minimumStock: true,
        maximumStock: true,
        averageCost: true,
        isActive: true,
        unit: {
          select: {
            id: true,
            name: true,
            abbreviation: true,
          },
        },
      },
    });
  },

  async searchByName(query: string, limit: number = 20) {
    // Búsqueda fuzzy de ingredientes por nombre o SKU
    // Retorna ingredientes que coincidan parcialmente
    return prisma.ingredient.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        OR: [
          {
            name: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            sku: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        minimumStock: true,
        maximumStock: true,
        averageCost: true,
        isActive: true,
        unit: {
          select: {
            id: true,
            name: true,
            abbreviation: true,
          },
        },
      },
      orderBy: [
        { name: 'asc' },
      ],
      take: limit,
    });
  },

  async findWithPagination(
    page: number,
    limit: number,
    where: Prisma.IngredientWhereInput = {},
    stockStatus: 'all' | 'normal' | 'low_stock' | 'out_of_stock' = 'all',
  ) {
    const skip = paginationOffset(page, limit);
    // The stock status compares two columns, so it is filtered in the query (before paging).
    const minimum = prisma.ingredient.fields.minimumStock;
    const stockWhere: Prisma.IngredientWhereInput =
      stockStatus === 'out_of_stock' ? { currentStock: { lte: 0 } }
      : stockStatus === 'low_stock' ? { AND: [{ currentStock: { gt: 0 } }, { currentStock: { lte: minimum } }] }
      : stockStatus === 'normal' ? { currentStock: { gt: minimum } }
      : {};
    // Exclude soft-deleted ingredients
    const whereWithDeleted = { AND: [where, stockWhere], deletedAt: null };

    const [ingredients, total] = await Promise.all([
      prisma.ingredient.findMany({
        where: whereWithDeleted,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          sku: true,
          currentStock: true,
          minimumStock: true,
          maximumStock: true,
          averageCost: true,
          isActive: true,
          createdAt: true,
          unit: {
            select: {
              id: true,
              name: true,
              abbreviation: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.ingredient.count({ where: whereWithDeleted }),
    ]);

    return {
      data: ingredients,
      pagination: paginationMeta(page, limit, total),
    };
  },

  async findLowStock() {
    // Find ingredients where currentStock <= minimumStock, filtered in the query itself
    // instead of fetching every active ingredient and comparing in JavaScript.
    return prisma.ingredient.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        currentStock: { lte: prisma.ingredient.fields.minimumStock },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        minimumStock: true,
        maximumStock: true,
        averageCost: true,
        unit: {
          select: {
            id: true,
            name: true,
            abbreviation: true,
          },
        },
      },
      orderBy: {
        currentStock: 'asc',
      },
    });
  },

  async findMovements(
    ingredientId?: string,
    type?: string,
    startDate?: Date,
    endDate?: Date,
    page: number = 1,
    limit: number = 50,
    search?: string,
    orderId?: string,
  ) {
    const skip = paginationOffset(page, limit);

    const where: Prisma.InventoryMovementWhereInput = {
      ...(ingredientId && { ingredientId }),
      ...(type && { type }),
      // Movements of one sale: its consumption, and the reversal/waste of its cancellation.
      ...(orderId && { referenceId: orderId, referenceType: { in: ['order', 'order_cancellation'] } }),
      ...(startDate || endDate
        ? {
          createdAt: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          },
        }
        : {}),
      ...(search && {
        ingredient: {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { sku: { contains: search, mode: 'insensitive' } },
          ],
        },
      }),
    };

    const [movements, total] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          quantity: true,
          unitCost: true,
          referenceType: true,
          referenceId: true,
          reason: true,
          notes: true,
          balanceAfter: true,
          createdAt: true,
          // Sale line that originated it: product, size and order number.
          orderItem: { select: { productName: true, size: true, order: { select: { id: true, orderNumber: true } } } },
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
          ingredient: {
            select: {
              id: true,
              name: true,
              sku: true,
              unit: {
                select: {
                  abbreviation: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.inventoryMovement.count({ where }),
    ]);

    return {
      data: movements,
      pagination: paginationMeta(page, limit, total),
    };
  },

  async getTotalInventoryValue() {
    // Prisma's aggregate _sum can only sum a single column, not a product of two
    // (currentStock * averageCost), so the per-row value has to be computed here.
    const ingredients = await prisma.ingredient.findMany({
      where: { isActive: true, deletedAt: null },
      select: {
        currentStock: true,
        averageCost: true,
      },
    });

    // Negative stock (a sale beyond the recorded stock, decision D-1) is worth 0, not less.
    const totalValue = ingredients.reduce(
      (sum, ing) => sum.add(Prisma.Decimal.max(ing.currentStock, 0).mul(ing.averageCost)),
      new Prisma.Decimal(0),
    );

    return totalValue;
  },

  async getInventorySummary() {
    const [totalIngredients, lowStockCount, outOfStockCount, totalValue] =
      await Promise.all([
        prisma.ingredient.count({ where: { isActive: true, deletedAt: null } }),
        prisma.ingredient.count({
          where: {
            isActive: true,
            deletedAt: null,
            currentStock: {
              gt: 0,
              lte: prisma.ingredient.fields.minimumStock,
            },
          },
        }),
        prisma.ingredient.count({
          where: {
            isActive: true,
            deletedAt: null,
            currentStock: { lte: 0 },
          },
        }),
        this.getTotalInventoryValue(),
      ]);

    return {
      totalIngredients,
      lowStockCount,
      outOfStockCount,
      totalValue: totalValue.toFixed(2),
    };
  },

  async create(data: {
    name: string;
    sku: string;
    unitId: string;
    minimumStock?: Prisma.Decimal | number;
    maximumStock?: Prisma.Decimal | number | null;
  }) {
    return prisma.ingredient.create({
      data: {
        name: data.name.trim(),
        sku: data.sku.trim(),
        unitId: data.unitId,
        minimumStock: data.minimumStock ? new Prisma.Decimal(data.minimumStock) : new Prisma.Decimal(0),
        maximumStock: data.maximumStock === undefined || data.maximumStock === null ? null : new Prisma.Decimal(data.maximumStock),
        currentStock: new Prisma.Decimal(0),
        averageCost: new Prisma.Decimal(0),
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        minimumStock: true,
        maximumStock: true,
        averageCost: true,
        isActive: true,
        createdAt: true,
        unit: {
          select: {
            id: true,
            name: true,
            abbreviation: true,
          },
        },
      },
    });
  },

  async update(
    id: string,
    data: {
      name?: string;
      sku?: string;
      minimumStock?: Prisma.Decimal | number;
      maximumStock?: Prisma.Decimal | number | null;
    },
  ) {
    return prisma.ingredient.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        // A blank SKU keeps the current one: every ingredient has a SKU (dev→prod sync key).
        ...(data.sku?.trim() && { sku: data.sku.trim() }),
        ...(data.minimumStock !== undefined && { minimumStock: new Prisma.Decimal(data.minimumStock) }),
        ...(data.maximumStock !== undefined && {
          maximumStock: data.maximumStock === null ? null : new Prisma.Decimal(data.maximumStock),
        }),
      },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        minimumStock: true,
        maximumStock: true,
        averageCost: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        unit: {
          select: {
            id: true,
            name: true,
            abbreviation: true,
          },
        },
      },
    });
  },

  async setActive(id: string, isActive: boolean) {
    return prisma.ingredient.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        minimumStock: true,
        maximumStock: true,
        averageCost: true,
        isActive: true,
        createdAt: true,
        unit: {
          select: {
            id: true,
            name: true,
            abbreviation: true,
          },
        },
      },
    });
  },

  async delete(id: string) {
    // Soft delete: mark as deleted instead of removing the record
    return prisma.ingredient.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  async countRelations(id: string) {
    const result = await prisma.ingredient.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            movements: true,
            purchaseItems: true,
            recipes: true,
            extraRecipes: true,
            countItems: true,
          },
        },
      },
    });
    return result?._count ?? null;
  },

  async getAllUnits() {
    return prisma.inventoryUnit.findMany({
      select: {
        id: true,
        name: true,
        abbreviation: true,
        dimension: true,
        factor: true,
      },
      orderBy: { name: 'asc' },
    });
  },

  async findUnitById(id: string, client: PrismaClient = prisma) {
    return client.inventoryUnit.findUnique({
      where: { id },
      select: { id: true, name: true, abbreviation: true, dimension: true, factor: true },
    });
  },

  /** Highest SKU with the given prefix (e.g. "INS-"), to number the next ingredient. */
  async findLastSkuWithPrefix(prefix: string) {
    const rows = await prisma.ingredient.findMany({
      where: { sku: { startsWith: prefix } },
      select: { sku: true },
    });
    return rows.map(({ sku }) => sku).filter((sku): sku is string => sku !== null);
  },

  /** Active products and extras whose recipe uses the ingredient. */
  async findActiveRecipeUsage(ingredientId: string) {
    const [products, extras] = await Promise.all([
      prisma.recipe.findMany({
        where: { ingredientId, product: { isActive: true } },
        select: { product: { select: { name: true } } },
        distinct: ['productId'],
      }),
      prisma.extraRecipe.findMany({
        where: { ingredientId, extra: { isActive: true } },
        select: { extra: { select: { name: true } } },
      }),
    ]);
    return [...products.map(({ product }) => product.name), ...extras.map(({ extra }) => extra.name)];
  },

  async updateStock(
    ingredientId: string,
    quantityChange: Prisma.Decimal | number,
    client: PrismaClient = prisma,
  ) {
    return client.ingredient.update({
      where: { id: ingredientId },
      data: { currentStock: { increment: quantityChange } },
      select: {
        id: true,
        name: true,
        currentStock: true,
        minimumStock: true,
        averageCost: true,
        isActive: true,
        unit: { select: { abbreviation: true } },
      },
    });
  },

  async createMovement(
    data: {
      ingredientId: string;
      type: string;
      quantity: Prisma.Decimal | number;
      unitCost?: Prisma.Decimal | number;
      referenceType?: string;
      referenceId?: string;
      reason?: string;
      notes?: string;
      createdById?: string;
      idempotencyKey?: string;
      /** Ingredient stock right after this movement (as returned by updateStock). */
      balanceAfter?: Prisma.Decimal | number;
      orderItemId?: string;
    },
    client: PrismaClient = prisma,
  ) {
    return client.inventoryMovement.create({
      data: {
        ingredientId: data.ingredientId,
        type: data.type,
        quantity: new Prisma.Decimal(data.quantity),
        unitCost: data.unitCost ? new Prisma.Decimal(data.unitCost) : undefined,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        reason: data.reason,
        notes: data.notes,
        createdById: data.createdById,
        idempotencyKey: data.idempotencyKey,
        balanceAfter: data.balanceAfter === undefined ? undefined : new Prisma.Decimal(data.balanceAfter),
        orderItemId: data.orderItemId,
      },
      select: {
        id: true,
        type: true,
        quantity: true,
        reason: true,
        notes: true,
        balanceAfter: true,
        createdAt: true,
      },
    });
  },

  async findMovementByIdempotencyKey(
    createdById: string,
    idempotencyKey: string,
    client: PrismaClient = prisma,
  ) {
    return client.inventoryMovement.findFirst({
      where: { createdById, idempotencyKey },
    });
  },

  /** Sale movements recorded for an order (to reverse them on cancellation). */
  async findSaleMovementsForOrder(tx: Prisma.TransactionClient, orderId: string) {
    return tx.inventoryMovement.findMany({ where: { referenceType: 'order', referenceId: orderId, type: 'sale' } });
  },

  async createMovements(
    data: Prisma.InventoryMovementCreateManyInput[],
    client: PrismaClient = prisma,
  ) {
    if (data.length === 0) return { count: 0 };
    return client.inventoryMovement.createMany({ data });
  },

  async updateStockAndCost(
    ingredientId: string,
    quantityChange: Prisma.Decimal | number,
    newAverageCost: Prisma.Decimal | number,
    client: PrismaClient = prisma,
  ) {
    return client.ingredient.update({
      where: { id: ingredientId },
      data: {
        currentStock: { increment: quantityChange },
        averageCost: new Prisma.Decimal(newAverageCost),
      },
    });
  },

  async findIngredientById(
    id: string,
    client: PrismaClient = prisma,
  ) {
    return client.ingredient.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        currentStock: true,
        averageCost: true,
        isActive: true,
      },
    });
  },
};
