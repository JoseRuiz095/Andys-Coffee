import type { ProductTemperature } from '../../../shared/utils/productTemperature'

/**
 * Representa un único ítem dentro de una categoría del menú.
 */
export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null; // Ruta relativa de la imagen en Supabase Storage, si existe.
  type: 'product' | 'combo';
  temperature?: ProductTemperature | null;
  jumboPrice?: number | null;
  size?: 'JUMBO';
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