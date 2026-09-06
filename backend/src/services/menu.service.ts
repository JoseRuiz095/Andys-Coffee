import { prisma } from '../config/prisma';
import { Promotion } from '@prisma/client';
import { calculateBestPromotion, isValidPromotion } from './pricing.service';

export const MenuService = {
  /**
   * Obtiene la estructura completa del menú, con categorías y sus productos y combos.
   * Solo incluye elementos activos y filtra combos y promociones según el día actual.
   */
  async getFullMenu() {
    const today = new Date();
    const currentDay = today.getDay(); // Domingo = 0, Lunes = 1, ...

    // 1. Obtener promociones activas por fecha. El filtro por día se hace en la aplicación para evitar timeouts.
    const promotionsByDate = await prisma.promotion.findMany({
      where: {
        isActive: true,
        startDate: { lte: today },
        endDate: { gte: today },
      },
      include: {
        products: { select: { productId: true } },
        categories: { select: { categoryId: true } },
      },
    });

    const activePromotions = promotionsByDate.filter(promo => 
      promo.activeOnDays.length === 0 || promo.activeOnDays.includes(currentDay)
    );

    // 2. Crear mapas para búsqueda rápida de promociones
    const promotionsByProduct = new Map<string, Promotion[]>();
    const promotionsByCategory = new Map<string, Promotion[]>();
    for (const promo of activePromotions) {
      if (!isValidPromotion(promo)) continue;
      promo.products.forEach(p => promotionsByProduct.set(p.productId, [...(promotionsByProduct.get(p.productId) ?? []), promo]));
      promo.categories.forEach(c => promotionsByCategory.set(c.categoryId, [...(promotionsByCategory.get(c.categoryId) ?? []), promo]));
    }

    // 3. Obtener categorías con sus productos y combos. El filtro de combos por día se hace en la app.
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
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    // 4. Adaptar la estructura de datos y aplicar promociones
    return categories.map(category => {
      // Mapear y transformar productos, aplicando la lógica de promoción
      const products = category.products.map(product => {
        const promotions = [
          ...(promotionsByProduct.get(product.id) ?? []),
          ...(promotionsByCategory.get(product.categoryId || '') ?? []),
        ];
        const pricing = calculateBestPromotion(product.price, 1, promotions);
        const promotionData = pricing.promotion ? {
          id: pricing.promotion.id,
          name: promotions.find((promo) => promo.id === pricing.promotion?.id)?.name,
          description: promotions.find((promo) => promo.id === pricing.promotion?.id)?.description,
          type: pricing.promotion.type,
        } : null;

        return {
          ...product,
          price: pricing.total.toNumber(),
          type: 'product' as const,
          promotion: promotionData,
        };
      });

      // Filtrar y mapear combos activos para el día actual
      const activeCombos = category.combos.filter(
        combo => combo.activeOnDays.length === 0 || combo.activeOnDays.includes(currentDay)
      );

      const combos = activeCombos.map(combo => ({
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