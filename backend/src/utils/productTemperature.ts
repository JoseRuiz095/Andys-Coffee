import type { DrinkTemperature } from '@prisma/client';

export function getDrinkTemperature(productName: string, categoryName?: string | null): Exclude<DrinkTemperature, 'BOTH'> | null {
  const normalizedName = productName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  const normalizedCategory = categoryName?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

  if (normalizedCategory !== 'bebidas') return null;

  if (/(?:^|\s)(?:frio|iced|cold)$/.test(normalizedName)) return 'COLD';
  if (/(?:^|\s)(?:caliente|hot)$/.test(normalizedName)) return 'HOT';
  if (/^(?:latte|americano|espresso|cappuccino|matcha|mocha|chai|taro)\b/.test(normalizedName)) return 'HOT';
  return null;
}

export function isJumboLatteProduct(productName: string, categoryName?: string | null): boolean {
  const normalizedName = productName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  const normalizedCategory = categoryName?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

  return normalizedCategory === 'bebidas' && normalizedName.startsWith('latte ') && normalizedName !== 'latte jumbo';
}