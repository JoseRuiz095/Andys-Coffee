import type { ProductTemperature } from '../../../shared/utils/productTemperature'

/**
 * Representa un único ítem dentro de una categoría del menú.
 */
export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null; // URL pública de la imagen (la resuelve la API), o null si no tiene.
  type: 'product' | 'combo';
  temperature?: ProductTemperature | null;
  jumboPrice?: number | null;
  size?: 'JUMBO';
  /** Extras offered with a product (charged per unit of the product). */
  extras?: MenuExtra[];
}

export interface MenuExtra {
  id: string;
  name: string;
  price: number;
}

/** Extras chosen for a cart line: `quantity` is per unit of the product. */
export interface SelectedExtra {
  extraId: string;
  name: string;
  price: number;
  quantity: number;
}

/**
 * Representa una categoría del menú que contiene varios ítems.
 */
export interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

export const _ = {};