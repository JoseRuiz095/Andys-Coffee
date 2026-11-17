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
  /** POS grouping stored on the product (older products may not have it yet). */
  family?: { id: string; name: string; displayOrder: number } | null;
  variantLabel?: string | null;
  options?: { name: string; value: string }[];
  /** Combos: drinks sold hot and cold, whose temperature the sale needs. */
  temperatureChoices?: { productId: string; name: string }[];
}

/** Hot/cold chosen for one drink of a combo. */
export interface ComboTemperature {
  productId: string;
  temperature: 'HOT' | 'COLD';
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