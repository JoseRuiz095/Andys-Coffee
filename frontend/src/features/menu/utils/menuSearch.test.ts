import { describe, expect, it } from 'vitest'
import type { MenuCategory, MenuItem } from '../types/menu.types'
import { menuItemKey, normalizeSearchText, searchMenu } from './menuSearch'

const item = (id: string, name: string, type: MenuItem['type'] = 'product'): MenuItem => ({
  id, name, description: null, price: 10, imageUrl: null, type,
})

const menu: MenuCategory[] = [
  { id: 'c1', name: 'Bebidas', items: [item('p1', 'Café americano'), item('p2', 'Chai')] },
  { id: 'c2', name: 'Bagels', items: [item('p3', 'Bagel de café'), item('p1', 'Café americano')] },
  { id: 'c3', name: 'Combos', items: [item('p1', 'Combo café', 'combo')] },
]

describe('menuSearch', () => {
  it('ignores case and accents', () => {
    expect(normalizeSearchText('  CAFÉ ')).toBe('cafe')
  })

  it('searches every category, keeps menu order and says where each result is', () => {
    expect(searchMenu(menu, 'cafe').map(({ item: found, categoryName }) => [found.name, categoryName])).toEqual([
      ['Café americano', 'Bebidas'],
      ['Bagel de café', 'Bagels'],
      ['Combo café', 'Combos'],
    ])
  })

  it('returns nothing for an empty term or a missing menu', () => {
    expect(searchMenu(menu, '   ')).toEqual([])
    expect(searchMenu(undefined, 'chai')).toEqual([])
  })

  it('tells products and combos with the same id apart', () => {
    expect(menuItemKey('product', 'p1')).not.toBe(menuItemKey('combo', 'p1'))
  })
})
