import { prisma } from '../config/prisma';

export const MenuService = {
  /**
   * Obtiene la estructura completa del menú, con categorías y sus productos.
   * Solo incluye categorías y productos activos, y los ordena según `displayOrder`.
   */
  async getFullMenu() {
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
      },
    });

    // Adapt the data structure to what the frontend expects
    return categories.map(category => ({
      ...category,
      items: category.products.map(product => ({
        ...product,
        price: product.price.toNumber(), // Convert Decimal to number
      })),
    }));
  },
};