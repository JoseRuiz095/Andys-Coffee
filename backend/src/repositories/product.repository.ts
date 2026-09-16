import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

export const ProductRepository = {
  async findWithPagination(where: Prisma.ProductWhereInput, skip: number, limit: number) {
    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          displayOrder: 'asc',
        },
        include: {
          category: {
            select: { id: true, name: true }
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return { products, total };
  },

  async findById(id: string) {
    return prisma.product.findUnique({
      where: { id },
      include: {
        extras: { include: { extra: true } },
        recipes: { include: { ingredient: true } },
      },
    });
  },

  async findAuditFieldsById(id: string) {
    return prisma.product.findUnique({
      where: { id },
      select: { price: true, cost: true, isActive: true, imageUrl: true },
    });
  },

  async findImageById(id: string) {
    return prisma.product.findUnique({
      where: { id },
      select: { imageUrl: true },
    });
  },

  async create(data: Prisma.ProductUncheckedCreateInput) {
    return prisma.product.create({ data });
  },

  async update(id: string, data: Prisma.ProductUncheckedUpdateInput) {
    return prisma.product.update({ where: { id }, data });
  },

  async delete(id: string) {
    return prisma.product.delete({ where: { id } });
  },
};
