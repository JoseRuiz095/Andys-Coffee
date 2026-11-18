import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';
import type { DbClient, Tx } from './transaction';

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

  async findById(id: string, client: DbClient = prisma) {
    return client.product.findUnique({
      where: { id },
      include: {
        extras: { include: { extra: true } },
        family: { select: { id: true, name: true } },
        options: { select: { name: true, value: true }, orderBy: { name: 'asc' } },
        category: { select: { id: true, name: true, isBeverage: true } },
      },
    });
  },

  /** What the recipe rules need to know about a product before editing it. */
  async findForRecipeRules(id: string, client: DbClient = prisma) {
    return client.product.findUnique({
      where: { id },
      select: {
        id: true,
        isActive: true,
        tracksInventory: true,
        jumboPrice: true,
        temperature: true,
        category: { select: { isBeverage: true } },
        recipes: { select: { size: true, temperature: true } },
      },
    });
  },

  async findCategoryKind(categoryId: string, client: DbClient = prisma) {
    return client.category.findUnique({ where: { id: categoryId }, select: { id: true, isBeverage: true } });
  },

  /** Replaces the product's variant options (inside the caller's transaction). */
  async replaceOptions(tx: Tx, productId: string, options: { name: string; value: string }[]) {
    await tx.productVariantOption.deleteMany({ where: { productId } });
    if (options.length > 0) {
      await tx.productVariantOption.createMany({ data: options.map((option) => ({ productId, ...option })) });
    }
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

  /** Active product with this name, ignoring case and surrounding spaces (unique index). */
  async findActiveByName(name: string) {
    return prisma.product.findFirst({
      where: { isActive: true, name: { equals: name.trim(), mode: 'insensitive' } },
      select: { id: true, name: true },
    });
  },

  /** Product with this SKU ignoring case and spaces (products_sku_normalized_unique). */
  async findBySkuNormalized(sku: string) {
    return prisma.product.findFirst({
      where: { sku: { equals: sku.trim(), mode: 'insensitive' } },
      select: { id: true, name: true, sku: true },
    });
  },

  async countOrderItems(id: string) {
    return prisma.orderItem.count({ where: { productId: id } });
  },

  async create(data: Prisma.ProductUncheckedCreateInput, client: DbClient = prisma) {
    return client.product.create({ data });
  },

  async update(id: string, data: Prisma.ProductUncheckedUpdateInput, client: DbClient = prisma) {
    return client.product.update({ where: { id }, data });
  },

  async delete(id: string) {
    return prisma.product.delete({ where: { id } });
  },
};
