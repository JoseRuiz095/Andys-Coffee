import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

export const OrderRepository = {
  async findWithPagination(where: Prisma.OrderWhereInput, skip: number, limit: number) {
    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          items: {
            include: {
              extras: true,
            }
          },
          payments: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    return { orders, total };
  },

  async findById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            extras: true,
            product: true
          }
        },
        payments: true,
        createdBy: {
          select: {
            id: true,
            name: true,
          }
        }
      },
    });
  },
};
