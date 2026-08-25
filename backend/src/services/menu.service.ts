import { prisma } from '../config/prisma';
import { Promotion, PromotionType } from '@prisma/client';

export const MenuService = {
  /**
   * Obtiene la estructura completa del menú, con categorías y sus productos y combos.
   * Solo incluye elementos activos y filtra combos y promociones según el día actual.
   */
  async getFullMenu() {
    const today = new Date();
    const currentDay = today.getDay(); // Domingo = 0, Lunes = 1, ...

    // 1. Obtener promociones activas para el día de hoy
    const activePromotions = await prisma.promotion.findMany({
      where: {
        isActive: true,
        startDate: { lte: today },
        endDate: { gte: today },
        OR: [
          { activeOnDays: { isEmpty: true } },
          { activeOnDays: { has: currentDay } },
        ],
      },
      include: {
        products: { select: { productId: true } },
        categories: { select: { categoryId: true } },
      },
    });

    // 2. Crear mapas para búsqueda rápida de promociones
    const promotionsByProduct = new Map<string, Promotion>();
    const promotionsByCategory = new Map<string, Promotion>();
    for (const promo of activePromotions) {
      promo.products.forEach(p => promotionsByProduct.set(p.productId, promo));
      promo.categories.forEach(c => promotionsByCategory.set(c.categoryId, promo));
    }

    // 3. Obtener categorías con sus productos y combos filtrados por día
    const categories = await prisma.category.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        displayOrder: 'asc',
      },
      include: {
        products: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
        },
        combos: {
          where: {
            isActive: true,
            OR: [
              { activeOnDays: { isEmpty: true } },
              { activeOnDays: { has: currentDay } },
            ],
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    // 4. Adaptar la estructura de datos y aplicar promociones
    return categories.map(category => {
      // Mapear y transformar productos, aplicando la lógica de promoción
      const products = category.products.map(product => {
        const promo = promotionsByProduct.get(product.id) || promotionsByCategory.get(product.categoryId || '');

        let finalPrice = product.price.toNumber();
        let promotionData = null;

        if (promo) {
          promotionData = {
            id: promo.id,
            name: promo.name,
            description: promo.description,
            type: promo.type,
          };
          if (promo.type === PromotionType.FIXED_PRICE) {
            finalPrice = promo.discountValue.toNumber();
          }
        }

        return {
          ...product,
          price: finalPrice,
          type: 'product' as const,
          promotion: promotionData,
        };
      });

      // Mapear y transformar combos
      const combos = category.combos.map(combo => ({
        ...combo,
        price: combo.price.toNumber(),
        activeOnDays: combo.activeOnDays,
        type: 'combo' as const,
      }));

      // Unir y ordenar items
      const items = [...products, ...combos].sort((a, b) => a.displayOrder - b.displayOrder);

      return {
        id: category.id,
        name: category.name,
        items: items,
      };
    });
  },
};