/**
 * Representa un único ítem dentro de una categoría del menú.
 */
export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
}

/**
 * Representa una categoría del menú que contiene varios ítems.
 */
export interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}