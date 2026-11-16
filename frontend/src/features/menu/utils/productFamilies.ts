import type { MenuItem } from '../types/menu.types'

// Grouping of the POS menu into families (Latte, Chilaquiles…) and their options. The product's
// stored family, variant and options come first; the name rules are only the fallback for
// products that weren't normalized yet (scripts/normalize-catalog.ts).

export type DisplayProduct =
  | { kind: 'single'; product: MenuItem }
  | { kind: 'group'; key: string; title: string; variants: MenuItem[] }

export type DrinkTemperatureChoice = 'caliente' | 'frio'

export const DRINK_TEMPERATURES: readonly DrinkTemperatureChoice[] = ['caliente', 'frio']

export const BEVERAGE_FAMILIES = [
  'latte',
  'americano',
  'espresso',
  'cappuccino',
  'matcha',
  'mocha',
  'chai',
  'taro',
  'chilaquiles',
] as const

export const REFRESHER_NAMES = new Set(['bloom', 'limonada'])

export const normalizeProductName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const getDrinkFamily = (name: string): string | null => {
  const normalized = normalizeProductName(name)
  if (!normalized) return null

  if (REFRESHER_NAMES.has(normalized)) {
    return 'Refreshers'
  }

  for (const family of BEVERAGE_FAMILIES) {
    if (normalized.startsWith(family)) {
      return family[0].toUpperCase() + family.slice(1)
    }
  }

  return null
}

export const getTemperatureLabel = (name: string): 'caliente' | 'frio' => {
  const normalized = normalizeProductName(name)

  if (normalized.includes(' frio') || normalized.includes('iced') || normalized.includes('cold')) {
    return 'frio'
  }

  return 'caliente'
}

export const supportsTemperature = (variant: MenuItem, temperature: DrinkTemperatureChoice) => {
  if (variant.temperature === 'BOTH') return true
  if (variant.temperature === 'HOT') return temperature === 'caliente'
  if (variant.temperature === 'COLD') return temperature === 'frio'
  return getTemperatureLabel(variant.name) === temperature
}

export const getVariantLabel = (name: string) => {
  const normalized = name.replace(/^\s+|\s+$/g, '')
  const withoutBase = normalized
    .replace(/^(Latte|Americano|Espresso|Cappuccino|Matcha|Mocha|Chai|Taro|Chilaquiles)[\s-]+/i, '')
    // `(^|\s+)`: once the family is removed the temperature may be the whole remaining name.
    .replace(/(^|\s+)(Frio|Frío|Iced|Cold|Caliente|Hot)$/i, '')
    .replace(/(^|\s+)(Regular|Classic|Clásico|Normal)$/i, '')

  const trimmed = withoutBase.trim()
  return trimmed || 'Variante'
}

export const formatTemperature = (temperature: 'caliente' | 'frio') =>
  temperature === 'frio' ? 'Frío' : 'Caliente'

export type ChilaquilesSalsa = 'verde' | 'roja'
export type ChilaquilesProtein = 'naturales' | 'pollo' | 'arrachera' | 'huevo'

// The product's stored family, variant and options come first; the name rules below are only
// the fallback for products that weren't normalized yet (scripts/normalize-catalog.ts).
export const familyOf = (product: MenuItem): string | null => product.family?.name ?? getDrinkFamily(product.name)

export const variantLabelOf = (product: MenuItem) => product.variantLabel?.trim() || getVariantLabel(product.name)

export const optionOf = (product: MenuItem, name: string) =>
  product.options?.find((option) => normalizeProductName(option.name) === normalizeProductName(name))?.value

export const salsaOf = (product: MenuItem): ChilaquilesSalsa => {
  const stored = normalizeProductName(optionOf(product, 'Salsa') ?? '')
  if (stored.startsWith('verde')) return 'verde'
  if (stored.startsWith('roja')) return 'roja'
  return getChilaquilesSalsa(product.name)
}

export const CHILAQUILES_PROTEINS: readonly ChilaquilesProtein[] = ['naturales', 'pollo', 'arrachera', 'huevo']

export const proteinOf = (product: MenuItem): ChilaquilesProtein => {
  const stored = normalizeProductName(optionOf(product, 'Proteína') ?? '') as ChilaquilesProtein
  return CHILAQUILES_PROTEINS.includes(stored) ? stored : getChilaquilesProtein(product.name)
}

export const getChilaquilesSalsa = (name: string): ChilaquilesSalsa =>
  normalizeProductName(name).includes(' verdes') ? 'verde' : 'roja'

export const getChilaquilesProtein = (name: string): ChilaquilesProtein => {
  const normalized = normalizeProductName(name)

  if (normalized.includes(' pollo ')) return 'pollo'
  if (normalized.includes(' arrachera ')) return 'arrachera'
  if (normalized.includes(' huevo ')) return 'huevo'

  return 'naturales'
}
