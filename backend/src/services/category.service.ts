import { prisma } from '../config/prisma';
import { z } from 'zod';
import { createCategorySchema, updateCategorySchema } from '../validators/category.validator';

export const CategoryService = {
  async findAll() {
    return prisma.category.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
  },

  async create(data: z.infer<typeof createCategorySchema>) {
    return prisma.category.create({ data });
  },

  async update(id: string, data: z.infer<typeof updateCategorySchema>) {
    return prisma.category.update({
      where: { id },
      data,
    });
  },
  // ... otros métodos
};