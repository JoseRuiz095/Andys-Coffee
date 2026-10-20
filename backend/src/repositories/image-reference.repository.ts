import { prisma } from '../config/prisma';

export const ImageReferenceRepository = {
  /** Rows (products, combos, categories) whose imageUrl is any of `values`. */
  async count(values: string[]): Promise<number> {
    if (values.length === 0) return 0;
    const where = { imageUrl: { in: values } };
    const [products, combos, categories] = await Promise.all([
      prisma.product.count({ where }),
      prisma.combo.count({ where }),
      prisma.category.count({ where }),
    ]);
    return products + combos + categories;
  },
};
