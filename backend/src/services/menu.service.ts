import { MenuRepository } from '../repositories/menu.repository';
import { calculateBestPromotion, promotionsForProduct } from './pricing.service';
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

    const [activePromotions, categories] = await Promise.all([
      MenuRepository.findActivePromotions(todayDate, currentDay),
      MenuRepository.findMenuCategories(currentDay),
    ]);

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