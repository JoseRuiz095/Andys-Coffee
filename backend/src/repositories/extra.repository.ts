import { prisma } from '../config/prisma';
import type { Prisma } from '@prisma/client';
import type { Tx } from './transaction';

const extraSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  cost: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { products: true } },
} satisfies Prisma.ExtraSelect;

export const ExtraRepository = {
  async findAll() {
    return prisma.extra.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }], select: extraSelect });
  },

  async findById(id: string) {
    return prisma.extra.findUnique({ where: { id }, select: extraSelect });
  },

  /** Another extra with the same name (case and surrounding spaces ignored). */
  async findByNameInsensitive(name: string, excludeId?: string) {
    return prisma.extra.findFirst({
      where: { name: { equals: name.trim(), mode: 'insensitive' }, ...(excludeId && { id: { not: excludeId } }) },
      select: { id: true },
    });
  },

  async countByIds(ids: string[]) {
    return prisma.extra.count({ where: { id: { in: ids } } });
  },

  /** Sale lines that used the extra: once sold, it is deactivated instead of deleted. */
  async countSales(id: string) {
    return prisma.orderItemExtra.count({ where: { extraId: id } });
  },

  async create(data: Prisma.ExtraCreateInput) {
    return prisma.extra.create({ data, select: extraSelect });
  },

  async update(id: string, data: Prisma.ExtraUpdateInput) {
    return prisma.extra.update({ where: { id }, data, select: extraSelect });
  },

  async delete(id: string) {
    return prisma.extra.delete({ where: { id } });
  },

  /** Replaces the product's extra links (inside the caller's transaction). */
  async replaceProductExtras(tx: Tx, productId: string, extraIds: string[]) {
    await tx.productExtra.deleteMany({ where: { productId } });
    if (extraIds.length > 0) {
      await tx.productExtra.createMany({ data: extraIds.map((extraId) => ({ productId, extraId })) });
    }
  },
};
