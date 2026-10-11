export type ProductTemperature = 'HOT' | 'COLD' | 'BOTH'
export type OrderTemperature = Exclude<ProductTemperature, 'BOTH'>

export function getDrinkTemperature(productName: string, categoryName?: string | null): OrderTemperature | null {
  const normalizedName = productName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
  const normalizedCategory = categoryName?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

  if (categoryName && normalizedCategory !== 'bebidas') return null

  if (/(?:^|\s)(?:frio|iced|cold)$/.test(normalizedName)) return 'COLD'
  if (/(?:^|\s)(?:caliente|hot)$/.test(normalizedName)) return 'HOT'
  if (normalizedCategory === 'bebidas' && /^(?:latte|americano|espresso|cappuccino|matcha|mocha|chai|taro)\b/.test(normalizedName)) return 'HOT'
  return null
}

export function formatDrinkTemperature(temperature: ProductTemperature): string {
  if (temperature === 'BOTH') return 'Ambas'
  return temperature === 'COLD' ? 'Frío' : 'Caliente'
}

export function getDrinkDisplayName(productName: string, temperature?: ProductTemperature | null): string {
  if (!temperature) return productName
  return productName.replace(/\s+(?:Fr[ií]o|Iced|Cold|Caliente|Hot)$/i, '')
}