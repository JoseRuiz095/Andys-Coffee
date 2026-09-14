import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

export const PurchaseRepository = {
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
    const skip = (page - 1) * limit;

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
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
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
};
