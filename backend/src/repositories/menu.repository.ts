import { prisma } from '../config/prisma';

/** Prisma `select` for the products/categories a promotion applies to (N-01). */
export const promotionScopeSelect = {
  products: { select: { productId: true } },
  categories: { select: { categoryId: true } },
} as const;

/** "Active today" filter for records scheduled by weekday (empty list = every day). */
const activeOnWeekday = (weekday: number) => [{ activeOnDays: { isEmpty: true } }, { activeOnDays: { has: weekday } }];

export const MenuRepository = {
  /** Promotions active on the business date/weekday, with the products/categories they cover. */
  async findActivePromotions(businessDate: Date, weekday: number) {
    return prisma.promotion.findMany({
      where: {
        isActive: true,
        startDate: { lte: businessDate },
        endDate: { gte: businessDate },
        OR: activeOnWeekday(weekday),
      },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        discountValue: true,
        buyQuantity: true,
        getQuantity: true,
        ...promotionScopeSelect,
      },
    });
  },

  /** Active categories with their active products and the combos available on `weekday`. */
  async findMenuCategories(weekday: number) {
    return prisma.category.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        name: true,
        products: {
          where: { isActive: true },
          select: {
            id: true,
            categoryId: true,
            name: true,
            description: true,
            price: true,
            imageUrl: true,
            displayOrder: true,
          },
          orderBy: { displayOrder: 'asc' },
        },
        combos: {
          where: { isActive: true, OR: activeOnWeekday(weekday) },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            imageUrl: true,
            displayOrder: true,
            activeOnDays: true,
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
  },
};
