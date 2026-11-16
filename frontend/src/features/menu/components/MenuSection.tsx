import React from 'react'
import { Skeleton } from '../../../shared/components/Skeleton'
import type { MenuCategory, MenuItem, SelectedExtra } from '../types/menu.types'
import { normalizeProductName, familyOf, type DisplayProduct } from '../utils/productFamilies'
import { ProductCard, ProductFamilyCard } from './MenuProductCards'
import { ProductFamilyModal } from './ProductFamilyModal'
import { ProductExtrasModal } from './ProductExtrasModal'

interface MenuSectionProps {
  menu?: MenuCategory[]
  categoryNames?: string[]
  isLoading?: boolean
  selectedCategory?: string
  onSelectCategory?: (category: string) => void
  onAddToOrder?: (product: MenuItem, quantity: number, extras?: SelectedExtra[]) => void
}

export function MenuSection({
  menu,
  categoryNames = ['Bebidas', 'Bagels', 'Desayunos', 'Promociones', 'Otros'],
  isLoading = false,
  selectedCategory,
  onSelectCategory,
  onAddToOrder,
}: MenuSectionProps) {
  const [searchTerm, setSearchTerm] = React.useState('')
  // Single product with extras: chosen in a small dialog before adding it.
  const [productForExtras, setProductForExtras] = React.useState<MenuItem | null>(null)
  const [selectedFamily, setSelectedFamily] = React.useState<{
    key: string
    title: string
    variants: MenuItem[]
  } | null>(null)

  // Find the products for the selected category
  const productsToShow = React.useMemo(() => {
    if (!menu || !selectedCategory) {
      return []
    }
    return (menu.find((category) => category.name === selectedCategory)?.items ?? [])
      .filter((product) => normalizeProductName(product.name) !== 'latte jumbo')
  }, [menu, selectedCategory])

  const filteredProducts = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    if (!term) {
      return productsToShow
    }

    return productsToShow.filter((product) =>
      product.name.toLowerCase().includes(term),
    )
  }, [productsToShow, searchTerm])

  const displayProducts = React.useMemo<DisplayProduct[]>(() => {
    const groupedProducts = new Map<string, MenuItem[]>()

    for (const product of filteredProducts) {
      const family = familyOf(product) ?? (product.temperature === 'BOTH' ? product.name : null)
      if (!family) {
        continue
      }

      const variants = groupedProducts.get(family) ?? []
      variants.push(product)
      groupedProducts.set(family, variants)
    }

    const usedFamilies = new Set<string>()
    const result: DisplayProduct[] = []

    for (const product of filteredProducts) {
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

      if (usedFamilies.has(family)) {
        continue
      }

      usedFamilies.add(family)
      result.push({
        kind: 'group',
        key: family,
        title: family,
        variants: [...variants].sort((first, second) => first.price - second.price),
      })
    }

    return result
  }, [filteredProducts])

  const handleOpenFamilyModal = (item: { key: string; title: string; variants: MenuItem[] }) => {
    setSelectedFamily(item)
  }

  const closeFamilyModal = () => setSelectedFamily(null)

  if (isLoading) {
    return (
      <div
        className="space-y-4 rounded-[1.5rem] border p-6 shadow-[var(--shadow-card)]"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <div className="mb-6 flex justify-center gap-10 border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
          {categoryNames.map((cat) => (
            <Skeleton key={cat} className="h-10 w-24 rounded-lg" />
          ))}
        </div>

        {/* Products Grid Skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-[var(--color-border)]">
              <Skeleton className="h-40 w-full" />
              <div className="p-3">
                <Skeleton className="mb-2 h-4 w-28" />
                <Skeleton className="mb-3 h-3 w-full" />
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className="space-y-4 rounded-[1.5rem] border p-6 shadow-[var(--shadow-card)]"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <div className="mb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          {/* Centered while the tabs fit; otherwise they scroll from the first one. */}
          <div className="flex justify-center-safe gap-4 overflow-x-auto pb-1 [&>button]:shrink-0 [&>button]:whitespace-nowrap">
            {categoryNames.map((cat) => (
              <button
                key={cat}
                aria-pressed={selectedCategory === cat}
                onClick={() => onSelectCategory?.(cat)}
                className="whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors"
                style={{
                  borderColor: selectedCategory === cat ? 'var(--color-primary)' : 'transparent',
                  color: selectedCategory === cat ? 'var(--color-primary)' : 'var(--color-text-primary)',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="sticky top-0 z-10 rounded-xl border p-3 backdrop-blur" style={{ borderColor: 'var(--color-border)', backgroundColor: 'color-mix(in srgb, var(--color-surface) 85%, transparent)' }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar producto o bebida"
            aria-label="Buscar producto o bebida"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-input-bg)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>

        {/* The menu takes ~half the width from md: two cards per row on a tablet, four on desktop. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {displayProducts.length === 0 && !isLoading && (
            <div className="col-span-full py-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>
              No hay productos en esta categoría.
            </div>
          )}
          {displayProducts.map((item) =>
            item.kind === 'single' ? (
              <ProductCard
                key={item.product.id}
                product={item.product}
                onAddToOrder={onAddToOrder}
                onChooseExtras={setProductForExtras}
              />
            ) : (
              <ProductFamilyCard key={item.key} title={item.title} variants={item.variants} onOpen={() => handleOpenFamilyModal(item)} />
            ),
          )}
        </div>
      </div>

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
