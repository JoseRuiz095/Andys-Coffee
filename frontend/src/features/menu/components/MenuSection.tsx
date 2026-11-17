import React from 'react'
import { Skeleton } from '../../../shared/components/Skeleton'
import { XIcon } from '../../../components/ui/XIcon'
import type { MenuCategory, MenuItem, SelectedExtra, ComboTemperature } from '../types/menu.types'
import { normalizeProductName, familyOf, type DisplayProduct } from '../utils/productFamilies'
import { menuItemKey, searchMenu } from '../utils/menuSearch'
import { ProductCard, ProductFamilyCard } from './MenuProductCards'
import { ProductFamilyModal } from './ProductFamilyModal'
import { ProductExtrasModal } from './ProductExtrasModal'
import { ComboTemperatureModal } from './ComboTemperatureModal'

interface MenuSectionProps {
  menu?: MenuCategory[]
  categoryNames?: string[]
  isLoading?: boolean
  selectedCategory?: string
  onSelectCategory?: (category: string) => void
  onAddToOrder?: (product: MenuItem, quantity: number, extras?: SelectedExtra[], comboTemperatures?: ComboTemperature[]) => void
  /** Units already in the order per menu item (`menuItemKey`), shown on the cards. */
  quantities?: ReadonlyMap<string, number>
}

// Fixed 4 columns: new products only add rows below. Sized by the menu panel (container
// query), not the window: in portrait tablets the panel is ~450px wide and 4 columns would make
// ~100px cards, so it drops to 3 (and 2 on a very narrow panel).
const gridClassName = 'grid grid-cols-2 gap-3 @[24rem]:grid-cols-3 @[36rem]:grid-cols-4'

/** Single products and families (several variants, or one product served hot and cold). */
function groupDisplayProducts(products: MenuItem[]): DisplayProduct[] {
  const groupedProducts = new Map<string, MenuItem[]>()

  for (const product of products) {
    const family = familyOf(product) ?? (product.temperature === 'BOTH' ? product.name : null)
    if (!family) continue
    const variants = groupedProducts.get(family) ?? []
    variants.push(product)
    groupedProducts.set(family, variants)
  }

  const usedFamilies = new Set<string>()
  const result: DisplayProduct[] = []

  for (const product of products) {
    const family = familyOf(product) ?? (product.temperature === 'BOTH' ? product.name : null)

    if (!family) {
      result.push({ kind: 'single', product })
      continue
    }

    const variants = groupedProducts.get(family) ?? []
    if (variants.length <= 1 && product.temperature !== 'BOTH') {
      result.push({ kind: 'single', product })
      continue
    }

    if (usedFamilies.has(family)) continue

    usedFamilies.add(family)
    result.push({
      kind: 'group',
      key: family,
      title: family,
      variants: [...variants].sort((first, second) => first.price - second.price),
    })
  }

  return result
}

// Typography of buttons and inputs is set on their container or on an inner span: index.css has
// an unlayered `button, input { font: inherit }` that overrides font utilities on the element.

const isSellable = (product: MenuItem) => normalizeProductName(product.name) !== 'latte jumbo'

export function MenuSection({
  menu,
  categoryNames = ['Bebidas', 'Bagels', 'Desayunos', 'Promociones', 'Otros'],
  isLoading = false,
  selectedCategory,
  onSelectCategory,
  onAddToOrder,
  quantities,
}: MenuSectionProps) {
  const [searchTerm, setSearchTerm] = React.useState('')
  // Single product with extras: chosen in a small dialog before adding it.
  const [productForExtras, setProductForExtras] = React.useState<MenuItem | null>(null)
  const [comboForTemperatures, setComboForTemperatures] = React.useState<MenuItem | null>(null)
  const [selectedFamily, setSelectedFamily] = React.useState<{
    key: string
    title: string
    variants: MenuItem[]
  } | null>(null)

  const isSearching = searchTerm.trim().length > 0

  // Typing searches the whole menu (the cashier doesn't need to know the category); with an
  // empty box the selected category is shown.
  const searchResults = React.useMemo(
    () => (isSearching ? searchMenu(menu, searchTerm).filter(({ item }) => isSellable(item)) : []),
    [isSearching, menu, searchTerm],
  )

  const productsToShow = React.useMemo(() => {
    if (isSearching) return searchResults.map(({ item }) => item)
    if (!menu || !selectedCategory) return []
    return (menu.find((category) => category.name === selectedCategory)?.items ?? []).filter(isSellable)
  }, [isSearching, menu, searchResults, selectedCategory])

  const categoryOf = React.useMemo(
    () => new Map(searchResults.map(({ item, categoryName }) => [menuItemKey(item.type, item.id), categoryName])),
    [searchResults],
  )

  const displayProducts = React.useMemo(() => groupDisplayProducts(productsToShow), [productsToShow])

  const quantityOf = (item: MenuItem) => quantities?.get(menuItemKey(item.type, item.id)) ?? 0

  const selectCategory = (category: string, button: HTMLButtonElement) => {
    setSearchTerm('')
    onSelectCategory?.(category)
    button.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  const closeFamilyModal = () => setSelectedFamily(null)

  if (isLoading) {
    return (
      <section
        aria-label="Menú"
        aria-busy="true"
        className="@container flex flex-col overflow-hidden rounded-[1.25rem] border shadow-[var(--shadow-card)] pos-fit:min-h-0"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <div className="flex flex-col gap-2 border-b p-3 lg:flex-row lg:items-center" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex flex-1 flex-wrap gap-1.5">
            {categoryNames.map((cat) => (
              <Skeleton key={cat} className="h-10 w-24 shrink-0 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-10 w-full rounded-xl lg:w-52 xl:w-56" />
        </div>
        <div className={`${gridClassName} p-3`}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
              <Skeleton className="aspect-[4/3] @[36rem]:aspect-[16/9] h-auto w-full rounded-none" />
              <div className="space-y-2 p-3">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <>
      <section
        aria-label="Menú"
        className="@container flex flex-col rounded-[1.25rem] border shadow-[var(--shadow-card)] pos-fit:min-h-0 pos-fit:overflow-hidden"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        {/* Categories and search in one bar (side by side from 1024px). Categories wrap instead
            of scrolling sideways, so none is ever hidden. It stays on top while the products scroll. */}
        <div
          className="sticky top-0 z-10 flex flex-col gap-2 rounded-t-[1.25rem] border-b p-3 lg:flex-row lg:items-start"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
          <div role="group" aria-label="Categorías" className="flex min-w-0 flex-1 flex-wrap gap-1.5 text-base">
            {categoryNames.map((cat) => {
              const isActive = !isSearching && selectedCategory === cat
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={isActive}
                  onClick={(event) => selectCategory(cat, event.currentTarget)}
                  className="min-h-10 shrink-0 whitespace-nowrap rounded-full border px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-primary)_45%,transparent)] pointer-coarse:min-h-11"
                  style={{
                    borderColor: isActive ? 'var(--color-primary)' : 'var(--color-border)',
                    backgroundColor: isActive ? 'color-mix(in srgb, var(--color-primary) 14%, var(--color-surface))' : 'var(--color-surface)',
                    color: isActive ? 'var(--color-primary)' : 'var(--color-text-primary)',
                    fontWeight: isActive ? 700 : 500,
                  }}
                >
                  {cat}
                </button>
              )
            })}
          </div>

          <div className="relative w-full shrink-0 text-[0.9375rem] lg:w-52 xl:w-56">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-text-secondary)' }}>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && searchTerm) {
                  event.preventDefault()
                  setSearchTerm('')
                }
              }}
              placeholder="Buscar en el menú"
              aria-label="Buscar producto o bebida"
              className="min-h-10 w-full rounded-xl border pl-9 pr-10 outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-primary)_30%,transparent)] pointer-coarse:min-h-11 [&::-webkit-search-cancel-button]:hidden"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-input-bg)',
                color: 'var(--color-text-primary)',
              }}
            />
            {isSearching && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-0 top-0 flex h-full w-10 items-center justify-center rounded-r-xl"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <XIcon size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="overscroll-contain p-3 pos-fit:min-h-0 pos-fit:flex-1 pos-fit:overflow-y-auto">
          {isSearching && (
            <p className="mb-2 text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }} aria-live="polite">
              {searchResults.length === 1 ? '1 resultado' : `${searchResults.length} resultados`} en todo el menú
            </p>
          )}
          <div className={gridClassName}>
            {displayProducts.length === 0 && (
              <div className="col-span-full py-8 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {isSearching ? `No hay productos que coincidan con “${searchTerm.trim()}”.` : 'No hay productos en esta categoría.'}
              </div>
            )}
            {displayProducts.map((item) =>
              item.kind === 'single' ? (
                <ProductCard
                  key={item.product.id}
                  product={item.product}
                  onAddToOrder={onAddToOrder}
                  onChooseExtras={setProductForExtras}
                  onChooseComboTemperatures={setComboForTemperatures}
                  quantityInOrder={quantityOf(item.product)}
                  caption={isSearching ? categoryOf.get(menuItemKey(item.product.type, item.product.id)) : undefined}
                />
              ) : (
                <ProductFamilyCard
                  key={item.key}
                  title={item.title}
                  variants={item.variants}
                  onOpen={() => setSelectedFamily(item)}
                  quantityInOrder={item.variants.reduce((sum, variant) => sum + quantityOf(variant), 0)}
                  caption={isSearching ? categoryOf.get(menuItemKey(item.variants[0].type, item.variants[0].id)) : undefined}
                />
              ),
            )}
          </div>
        </div>
      </section>

      {comboForTemperatures && (
        <ComboTemperatureModal
          combo={comboForTemperatures}
          onClose={() => setComboForTemperatures(null)}
          onAddToOrder={onAddToOrder}
        />
      )}

      {productForExtras && (
        <ProductExtrasModal
          product={productForExtras}
          onClose={() => setProductForExtras(null)}
          onAddToOrder={onAddToOrder}
        />
      )}

      {selectedFamily && (
        <ProductFamilyModal
          family={selectedFamily}
          onClose={closeFamilyModal}
          onAddToOrder={onAddToOrder}
        />
      )}
    </>
  )
}
