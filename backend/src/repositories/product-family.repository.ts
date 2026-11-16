import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { DbClient } from './transaction';

const familySelect = {
  id: true,
  name: true,
  categoryId: true,
  displayOrder: true,
  isActive: true,
  _count: { select: { products: true } },
} satisfies Prisma.ProductFamilySelect;

export const ProductFamilyRepository = {
  async findAll() {
    return prisma.productFamily.findMany({ orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }], select: familySelect });
  },

  async findById(id: string, client: DbClient = prisma) {
    return client.productFamily.findUnique({ where: { id }, select: familySelect });
  },

  /** Another family with the same name (case and surrounding spaces ignored, unique index). */
  async findByNameInsensitive(name: string, excludeId?: string) {
    return prisma.productFamily.findFirst({
      where: { name: { equals: name.trim(), mode: 'insensitive' }, ...(excludeId && { id: { not: excludeId } }) },
      select: { id: true, name: true },
    });
  },

  async create(data: Prisma.ProductFamilyUncheckedCreateInput) {
    return prisma.productFamily.create({ data, select: familySelect });
  },

  async update(id: string, data: Prisma.ProductFamilyUncheckedUpdateInput) {
    return prisma.productFamily.update({ where: { id }, data, select: familySelect });
  },
};
