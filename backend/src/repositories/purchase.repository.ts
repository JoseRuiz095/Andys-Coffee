import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';
import { paginationMeta, paginationOffset } from '../utils/pagination';

type PrismaClient = Prisma.TransactionClient | typeof prisma;

export const PurchaseRepository = {
  async findByIdempotencyKey(createdById: string, idempotencyKey: string, client: PrismaClient = prisma) {
    return client.purchase.findFirst({
      where: { createdById, idempotencyKey },
      include: { items: { include: { ingredient: { include: { unit: true } } } }, supplier: true },
    });
  },

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

  /** Deletes the purchase only while it is still a draft; returns how many rows went away. */
  async deleteDraft(id: string) {
    return prisma.purchase.deleteMany({ where: { id, status: 'draft' } }).then((result) => result.count);
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
    extra: { purchasedAt?: Date } = {},
  ) {
    return client.purchase.update({
      where: { id },
      data: { status, ...extra },
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
    // INV-8: only active, not deleted ingredients can be bought.
    return client.ingredient.findMany({
      where: { id: { in: ingredientIds }, isActive: true, deletedAt: null },
      select: {
        id: true,
        currentStock: true,
        averageCost: true,
      },
    });
  },
};
