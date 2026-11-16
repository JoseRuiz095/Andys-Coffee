import { describe, expect, it } from 'vitest'
import type { MenuItem } from '../types/menu.types'
import { familyOf, getVariantLabel, proteinOf, salsaOf, supportsTemperature, variantLabelOf } from './productFamilies'

const item = (overrides: Partial<MenuItem>): MenuItem => ({
  id: 'p1',
  name: 'Producto',
  description: null,
  price: 50,
  imageUrl: null,
  type: 'product',
  ...overrides,
})

describe('familyOf', () => {
  it('prefers the family stored on the product', () => {
    expect(familyOf(item({ name: 'Latte Vainilla', family: { id: 'f1', name: 'Lattes', displayOrder: 0 } }))).toBe('Lattes')
  })

  it('falls back to the name for products not normalized yet', () => {
    expect(familyOf(item({ name: 'Latte Vainilla' }))).toBe('Latte')
    expect(familyOf(item({ name: 'Chilaquiles Verdes con Pollo' }))).toBe('Chilaquiles')
    expect(familyOf(item({ name: 'Limonada' }))).toBe('Refreshers')
    expect(familyOf(item({ name: 'Bagel de Queso' }))).toBeNull()
  })
})

describe('variant labels', () => {
  it('strips the family and temperature from the name', () => {
    expect(getVariantLabel('Latte Vainilla Frío')).toBe('Vainilla')
    expect(getVariantLabel('Americano Caliente')).toBe('Variante')
  })

  it('prefers the stored variant label', () => {
    expect(variantLabelOf(item({ name: 'Latte Caramelo', variantLabel: ' Caramelo salado ' }))).toBe('Caramelo salado')
  })
})

describe('supportsTemperature', () => {
  it('follows the stored temperature, then the name', () => {
    expect(supportsTemperature(item({ temperature: 'BOTH' }), 'frio')).toBe(true)
    expect(supportsTemperature(item({ temperature: 'HOT' }), 'frio')).toBe(false)
    expect(supportsTemperature(item({ name: 'Latte Iced' }), 'frio')).toBe(true)
    expect(supportsTemperature(item({ name: 'Latte Vainilla' }), 'caliente')).toBe(true)
  })
})

describe('Chilaquiles options', () => {
  it('reads salsa and protein from the stored options first', () => {
    const product = item({ name: 'Chilaquiles', options: [{ name: 'Salsa', value: 'Verde' }, { name: 'Proteína', value: 'arrachera' }] })
    expect(salsaOf(product)).toBe('verde')
    expect(proteinOf(product)).toBe('arrachera')
  })

  it('falls back to the name', () => {
    const product = item({ name: 'Chilaquiles Verdes con Pollo y Queso' })
    expect(salsaOf(product)).toBe('verde')
    expect(proteinOf(product)).toBe('pollo')
    expect(proteinOf(item({ name: 'Chilaquiles Rojos' }))).toBe('naturales')
  })
})
