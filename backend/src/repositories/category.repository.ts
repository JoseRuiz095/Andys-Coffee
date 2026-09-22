import { prisma } from '../config/prisma';
import type { Prisma } from '@prisma/client';

export const CategoryRepository = {
  async findAll(skip: number = 0, take: number = 100, includeInactive: boolean = false) {
    const where = includeInactive ? {} : { isActive: true };
    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        orderBy: { displayOrder: 'asc' },
        skip,
        take,
      }),
      prisma.category.count({ where }),
    ]);
    return { categories, total };
  },

  async findById(id: string) {
    return prisma.category.findUnique({
      where: { id },
      include: { products: { where: { isActive: true } } },
    });
  },

  async create(data: Prisma.CategoryCreateInput) {
    return prisma.category.create({ data });
  },

  async update(id: string, data: Prisma.CategoryUpdateInput) {
    return prisma.category.update({ where: { id }, data });
  },

  async delete(id: string) {
    return prisma.category.delete({ where: { id } });
  },
};
