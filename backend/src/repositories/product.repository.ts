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
      select: { price: true, jumboPrice: true, cost: true, isActive: true, imageUrl: true, temperature: true },
    });
  },

  async findImageById(id: string) {
    return prisma.product.findUnique({
      where: { id },
      select: { id: true, imageUrl: true },
    });
  },

  /**
   * Compare-and-set of the image: only writes when the row still holds `expected`, so two
   * concurrent replacements cannot both win (and neither deletes the other's file).
   * Returns false when the product changed or no longer exists.
   */
  async replaceImageIfUnchanged(id: string, expected: string | null, next: string | null) {
    const { count } = await prisma.product.updateMany({
      where: { id, imageUrl: expected },
      data: { imageUrl: next },
    });
    return count === 1;
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
