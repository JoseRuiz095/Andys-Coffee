import { prisma } from '../config/prisma';
import { PromotionType } from '@prisma/client';
import { calculateBestPromotion, isValidPromotion } from './pricing.service';
import { getTodayInZone } from '../utils/businessDate';

type MenuPromotion = {
  id: string;
  name: string;
  description: string | null;
  type: PromotionType;
  discountValue: import('@prisma/client').Prisma.Decimal;
  buyQuantity: number | null;
  getQuantity: number | null;
  products: { productId: string }[];
  categories: { categoryId: string }[];
};

export const MenuService = {
  /**
   * Obtiene la estructura completa del menú, con categorías y sus productos y combos.
   * Solo incluye elementos activos y filtra combos y promociones según el día actual.
   */
  async getFullMenu() {
    const today = getTodayInZone();
    const todayDate = new Date(today + ' 00:00:00');
    const currentDay = todayDate.getDay(); // Domingo = 0, Lunes = 1, ...

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
      },
    });

    const activePromotions = promotionsByDate;

    // 2. Crear mapas para búsqueda rápida de promociones
    // Nota: Las relaciones PromotionOnProduct y PromotionOnCategory fueron eliminadas (código muerto)
    const promotionsByProduct = new Map<string, MenuPromotion[]>();
    const promotionsByCategory = new Map<string, MenuPromotion[]>();
    // Promociones ahora se aplican globalmente sin mapeo específico a productos/categorías

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
        // Nota: Relaciones PromotionOnProduct/PromotionOnCategory fueron eliminadas (código muerto)
        // Ahora se aplican todas las promociones globales a todos los productos
        const promotions = activePromotions;
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