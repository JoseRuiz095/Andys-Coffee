import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

type PrismaClient = Prisma.TransactionClient | typeof prisma;

export const InventoryRepository = {
  async findAll(where: Prisma.IngredientWhereInput = {}, select: Prisma.IngredientSelect = {}) {
    return prisma.ingredient.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        minimumStock: true,
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
        ...select,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findById(id: string) {
    return prisma.ingredient.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        minimumStock: true,
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
    return prisma.ingredient.findUnique({
      where: { sku },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        minimumStock: true,
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
  ) {
    const skip = (page - 1) * limit;

    const [ingredients, total] = await Promise.all([
      prisma.ingredient.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          sku: true,
          currentStock: true,
          minimumStock: true,
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
      prisma.ingredient.count({ where }),
    ]);

    return {
      data: ingredients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async findLowStock() {
    // Find ingredients where currentStock <= minimumStock
    return prisma.ingredient.findMany({
      where: {
        isActive: true,
        // Using raw SQL comparison: currentStock <= minimumStock
      },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        minimumStock: true,
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
    }).then(ingredients =>
      ingredients.filter(ing => ing.currentStock.lte ? ing.currentStock.lte(ing.minimumStock) :
        new Prisma.Decimal(ing.currentStock).lte(ing.minimumStock))
    );
  },

  async findMovements(
    ingredientId?: string,
    type?: string,
    startDate?: Date,
    endDate?: Date,
    page: number = 1,
    limit: number = 50,
    search?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryMovementWhereInput = {
      ...(ingredientId && { ingredientId }),
      ...(type && { type }),
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
          notes: true,
          createdAt: true,
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
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getTotalInventoryValue() {
    const result = await prisma.ingredient.aggregate({
      _sum: {
        currentStock: true,
        averageCost: true,
      },
      where: {
        isActive: true,
      },
    });

    const ingredients = await prisma.ingredient.findMany({
      where: { isActive: true },
      select: {
        currentStock: true,
        averageCost: true,
      },
    });

    const totalValue = ingredients.reduce(
      (sum, ing) => sum.add(new Prisma.Decimal(ing.currentStock).mul(ing.averageCost)),
      new Prisma.Decimal(0),
    );

    return totalValue;
  },

  async getInventorySummary() {
    const [totalIngredients, lowStockCount, outOfStockCount, totalValue] =
      await Promise.all([
        prisma.ingredient.count({ where: { isActive: true } }),
        prisma.ingredient.count({
          where: {
            isActive: true,
            currentStock: {
              gt: 0,
              lte: prisma.ingredient.fields.minimumStock,
            },
          },
        }),
        prisma.ingredient.count({
          where: {
            isActive: true,
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
    sku?: string;
    unitId: string;
    minimumStock?: Prisma.Decimal | number;
  }) {
    return prisma.ingredient.create({
      data: {
        name: data.name.trim(),
        sku: data.sku?.trim() || null,
        unitId: data.unitId,
        minimumStock: data.minimumStock ? new Prisma.Decimal(data.minimumStock) : new Prisma.Decimal(0),
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
    },
  ) {
    return prisma.ingredient.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.sku !== undefined && { sku: data.sku?.trim() || null }),
        ...(data.minimumStock !== undefined && { minimumStock: new Prisma.Decimal(data.minimumStock) }),
      },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        minimumStock: true,
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
    return prisma.ingredient.delete({ where: { id } });
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
      },
      orderBy: { name: 'asc' },
    });
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
        averageCost: true,
        isActive: true,
      },
    });
  },

  async updateAverageCost(
    ingredientId: string,
    newAverageCost: Prisma.Decimal | number,
    client: PrismaClient = prisma,
  ) {
    return client.ingredient.update({
      where: { id: ingredientId },
      data: { averageCost: new Prisma.Decimal(newAverageCost) },
      select: {
        id: true,
        averageCost: true,
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
      },
      select: {
        id: true,
        type: true,
        quantity: true,
        reason: true,
        notes: true,
        createdAt: true,
      },
    });
  },

  async findIngredientById(
    id: string,
    client: PrismaClient = prisma,
  ) {
    return client.ingredient.findUnique({
      where: { id },
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
