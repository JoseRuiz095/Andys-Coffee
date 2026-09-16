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

  async findAll(
    page: number = 1,
    limit: number = 20,
    status?: string,
    date?: string,
    client: PrismaClient = prisma,
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryCountWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (date) {
      const dateObj = new Date(date);
      const nextDay = new Date(dateObj);
      nextDay.setDate(nextDay.getDate() + 1);

      where.createdAt = {
        gte: dateObj,
        lt: nextDay,
      };
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
