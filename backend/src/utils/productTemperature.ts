import type { DrinkTemperature } from '@prisma/client';

/**
 * Fallback for beverages whose `temperature` column is still empty: reads it from the name.
 * Only beverages (category `isBeverage`) have a temperature. Once every beverage has its
 * temperature stored (scripts/normalize-catalog.ts), the column is the only source.
 */
export function getDrinkTemperature(productName: string, isBeverage: boolean): Exclude<DrinkTemperature, 'BOTH'> | null {
  if (!isBeverage) return null;

  const normalizedName = productName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

  if (/(?:^|\s)(?:frio|iced|cold)$/.test(normalizedName)) return 'COLD';
  if (/(?:^|\s)(?:caliente|hot)$/.test(normalizedName)) return 'HOT';
  if (/^(?:latte|americano|espresso|cappuccino|matcha|mocha|chai|taro)\b/.test(normalizedName)) return 'HOT';
  return null;
}

/** A product offers the Jumbo size when it is a beverage with a Jumbo price. */
export function isJumboAvailable(product: { jumboPrice: unknown }, isBeverage: boolean): boolean {
  return isBeverage && product.jumboPrice !== null && product.jumboPrice !== undefined;
}
