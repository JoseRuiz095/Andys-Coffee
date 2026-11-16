import type { MenuCategory, MenuItem } from '../types/menu.types'

/** Lowercase without accents: "cafe" finds "Café", "CHAI" finds "Chai". */
export function normalizeSearchText(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

export interface MenuSearchResult {
  item: MenuItem
  /** Category the item belongs to, shown on the card while searching. */
  categoryName: string
}

/**
 * Items of every category whose name contains the term, in menu order. An item listed in more
 * than one category appears once (with its first category).
 */
export function searchMenu(menu: MenuCategory[] | undefined, term: string): MenuSearchResult[] {
  const needle = normalizeSearchText(term)
  if (!menu || !needle) return []
  const seen = new Set<string>()
  const results: MenuSearchResult[] = []
  for (const category of menu) {
    for (const item of category.items) {
      const key = menuItemKey(item.type, item.id)
      if (seen.has(key) || !normalizeSearchText(item.name).includes(needle)) continue
      seen.add(key)
      results.push({ item, categoryName: category.name })
    }
  }
  return results
}

/** Same key for a menu item and for the order lines that came from it. */
export function menuItemKey(type: MenuItem['type'], id: string | undefined): string {
  return `${type}:${id ?? ''}`
}
