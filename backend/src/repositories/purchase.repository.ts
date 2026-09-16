import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';
import { paginationMeta, paginationOffset } from '../utils/pagination';

type PrismaClient = Prisma.TransactionClient | typeof prisma;

export const PurchaseRepository = {
  async create(data: Prisma.PurchaseCreateInput, client: PrismaClient = prisma) {
    return client.purchase.create({
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
        supplier: true,
      },
    });
  },

  async findById(id: string) {
    return prisma.purchase.findUnique({
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
        supplier: true,
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  },

  async findAll(
    status?: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = paginationOffset(page, limit);

    const where = status ? { status } : {};

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        skip,
        take: limit,
        include: {
          items: true,
          supplier: true,
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          purchasedAt: 'desc',
        },
      }),
      prisma.purchase.count({ where }),
    ]);

    return {
      data: purchases,
      pagination: paginationMeta(page, limit, total),
    };
  },

  async delete(id: string) {
    return prisma.purchase.delete({ where: { id } });
  },

  async updateStatus(id: string, status: string) {
    return prisma.purchase.update({
      where: { id },
      data: { status },
      include: {
        items: {
          include: {
            ingredient: true,
          },
        },
      },
    });
  },

  async getPurchaseItems(purchaseId: string) {
    return prisma.purchaseItem.findMany({
      where: { purchaseId },
      include: {
        ingredient: {
          include: {
            unit: true,
          },
        },
      },
    });
  },

  async findByIdWithItems(
    id: string,
    client: PrismaClient = prisma,
  ) {
    return client.purchase.findUnique({
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

  async updateStatusAndReturn(
    id: string,
    status: string,
    client: PrismaClient = prisma,
  ) {
    return client.purchase.update({
      where: { id },
      data: { status },
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
        supplier: true,
      },
    });
  },

  async findIngredientsForPurchase(ingredientIds: string[], client: PrismaClient = prisma) {
    return client.ingredient.findMany({
      where: { id: { in: ingredientIds } },
      select: {
        id: true,
        currentStock: true,
        averageCost: true,
      },
    });
  },

  async createPurchaseItems(
    purchaseId: string,
    items: { ingredientId: string; quantity: string | number; unitCost: string | number; total: string | number }[],
    client: PrismaClient = prisma,
  ) {
    return client.purchaseItem.createMany({
      data: items.map(item => ({
        purchaseId,
        ingredientId: item.ingredientId,
        quantity: new Prisma.Decimal(item.quantity),
        unitCost: new Prisma.Decimal(item.unitCost),
        total: new Prisma.Decimal(item.total),
      })),
    });
  },
};
