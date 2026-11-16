import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';
import { paginationMeta, paginationOffset } from '../utils/pagination';
import { getZonedDayBoundaries } from '../utils/businessDate';

type PrismaClient = Prisma.TransactionClient | typeof prisma;

export const InventoryCountRepository = {
  async findByIdempotencyKey(createdById: string, idempotencyKey: string, client: PrismaClient = prisma) {
    return client.inventoryCount.findFirst({ where: { createdById, idempotencyKey } });
  },

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

  async findAll(
    page: number = 1,
    limit: number = 20,
    status?: string,
    date?: string,
    client: PrismaClient = prisma,
  ) {
    const skip = paginationOffset(page, limit);

    const where: Prisma.InventoryCountWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (date) {
      // INV-3: the business day in CASH_TIMEZONE (UTC midnight moved counts made after
      // 18:00 local to the next day).
      const { start, end } = getZonedDayBoundaries(date);
      where.createdAt = { gte: start, lt: end };
    }

    const [counts, total] = await Promise.all([
      client.inventoryCount.findMany({
        where,
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
      client.inventoryCount.count({ where }),
    ]);

    return {
      data: counts,
      pagination: paginationMeta(page, limit, total),
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
        // INV-2: a recapture is compared against the stock at that moment, so both change.
        systemQuantity: new Prisma.Decimal(data.systemQuantity),
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

  async deleteItem(
    countId: string,
    ingredientId: string,
    client: PrismaClient = prisma,
  ) {
    return client.inventoryCountItem.delete({
      where: {
        inventoryCountId_ingredientId: {
          inventoryCountId: countId,
          ingredientId,
        },
      },
    });
  },

  async delete(id: string, client: PrismaClient = prisma) {
    return client.inventoryCount.delete({ where: { id } });
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
