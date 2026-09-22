import { prisma } from '../config/prisma';
import { calculateBestPromotion, promotionScopeSelect, promotionsForProduct } from './pricing.service';
import { getTodayInZone, getCalendarDateAsUtc } from '../utils/businessDate';

export const MenuService = {
  /**
   * Obtiene la estructura completa del menú, con categorías y sus productos y combos.
   * Solo incluye elementos activos y filtra combos y promociones según el día actual.
   */
  async getFullMenu() {
    // L-07: business day as a calendar date (Domingo = 0, Lunes = 1, ...), independent of the
    // server's timezone, so a promotion still applies on its last day.
    const { date: todayDate, weekday: currentDay } = getCalendarDateAsUtc(getTodayInZone());

    // 1. Filtrar fecha y día en la base de datos para evitar traer promociones inactivas.
    const promotionsByDate = await prisma.promotion.findMany({
      where: {
        isActive: true,
        startDate: { lte: todayDate },
        endDate: { gte: todayDate },
        OR: [{ activeOnDays: { isEmpty: true } }, { activeOnDays: { has: currentDay } }],
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

    const activePromotions = promotionsByDate;

    // 3. Seleccionar únicamente los campos que necesita el menú público.
    const categories = await prisma.category.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        displayOrder: 'asc',
      },
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
          where: {
            isActive: true,
            OR: [{ activeOnDays: { isEmpty: true } }, { activeOnDays: { has: currentDay } }],
          },
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

    // 4. Adaptar la estructura de datos y aplicar promociones
    return categories.map(category => {
      // Mapear y transformar productos, aplicando la lógica de promoción
      const products = category.products.map(product => {
        // Only the promotions linked to this product or its category (N-01).
        const promotions = promotionsForProduct(activePromotions, { id: product.id, categoryId: category.id });
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