import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

type PrismaClient = Prisma.TransactionClient | typeof prisma;

export const InventoryCountRepository = {
  async findById(
    id: string,
    client: PrismaClient = prisma,
  ) {
    return client.inventoryCount.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            ingredient: {
              include: {
                unit: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        completedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  },

  async findByIdWithItems(
    id: string,
    client: PrismaClient = prisma,
  ) {
    return client.inventoryCount.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            ingredient: true,
          },
        },
      },
    });
  },

  async findAll(page: number = 1, limit: number = 20, client: PrismaClient = prisma) {
    const skip = (page - 1) * limit;

    const [counts, total] = await Promise.all([
      client.inventoryCount.findMany({
        skip,
        take: limit,
        include: {
          items: true,
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
          completedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      client.inventoryCount.count(),
    ]);

    return {
      data: counts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async create(
    data: { createdById: string; status: string },
    client: PrismaClient = prisma,
  ) {
    return client.inventoryCount.create({
      data,
      include: {
        items: {
          include: {
            ingredient: {
              include: {
                unit: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  },

  async updateStatus(
    id: string,
    status: string,
    completedById?: string,
    client: PrismaClient = prisma,
  ) {
    return client.inventoryCount.update({
      where: { id },
      data: {
        status,
        ...(completedById && { completedById, completedAt: new Date() }),
      },
      include: {
        items: {
          include: {
            ingredient: {
              include: {
                unit: true,
              },
            },
          },
        },
      },
    });
  },

  async upsertItem(
    countId: string,
    ingredientId: string,
    data: {
      systemQuantity: Prisma.Decimal | number;
      countedQuantity: Prisma.Decimal | number;
      difference: Prisma.Decimal | number;
      notes: string | null;
    },
    client: PrismaClient = prisma,
  ) {
    return client.inventoryCountItem.upsert({
      where: {
        inventoryCountId_ingredientId: {
          inventoryCountId: countId,
          ingredientId,
        },
      },
      create: {
        inventoryCountId: countId,
        ingredientId,
        systemQuantity: new Prisma.Decimal(data.systemQuantity),
        countedQuantity: new Prisma.Decimal(data.countedQuantity),
        difference: new Prisma.Decimal(data.difference),
        notes: data.notes,
      },
      update: {
        countedQuantity: new Prisma.Decimal(data.countedQuantity),
        difference: new Prisma.Decimal(data.difference),
        notes: data.notes,
      },
      include: {
        ingredient: {
          include: {
            unit: true,
          },
        },
      },
    });
  },

  async findIngredientsForCount(
    ingredientIds: string[],
    client: PrismaClient = prisma,
  ) {
    return client.ingredient.findMany({
      where: { id: { in: ingredientIds } },
      select: {
        id: true,
        currentStock: true,
      },
    });
  },
};
