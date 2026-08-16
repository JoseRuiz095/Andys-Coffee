import { prisma } from '../config/prisma';
import { z } from 'zod';
import { filterQuerySchema } from '../validators/product.validator';

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  type: 'product' | 'combo';
  categoryId: string | null;
  displayOrder: number;
}

export const MenuService = {
  async getMenuItems(query: z.infer<typeof filterQuerySchema>) {
    const where = {
      isActive: true,
      ...(query.category && { categoryId: query.category }),
      ...(query.search && {
        name: {
          contains: query.search,
          mode: 'insensitive' as const,
        },
      }),
    };

    const productsPromise = prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        imageUrl: true,
        categoryId: true,
        displayOrder: true,
      },
    });

    const combosPromise = prisma.combo.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        imageUrl: true,
        categoryId: true,
        displayOrder: true,
      },
    });

    const [products, combos] = await Promise.all([productsPromise, combosPromise]);

    const productItems: MenuItem[] = products.map((p) => ({
      ...p,
      price: p.price.toNumber(),
      type: 'product',
    }));

    const comboItems: MenuItem[] = combos.map((c) => ({
      ...c,
      price: c.price.toNumber(),
      type: 'combo',
    }));

    return [...productItems, ...comboItems].sort((a, b) => a.displayOrder - b.displayOrder);
  },
};