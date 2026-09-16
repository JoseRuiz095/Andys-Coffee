import React from 'react'
import { Skeleton } from '../../../shared/components/Skeleton'
import type { MenuCategory, MenuItem } from '../types/menu.types'
import { getSupabaseImageUrl } from '../../../shared/utils/imageUtils'

interface MenuSectionProps {
  menu?: MenuCategory[]
  categoryNames?: string[]
  isLoading?: boolean
  selectedCategory?: string
  onSelectCategory?: (category: string) => void
  onAddToOrder?: (product: MenuItem, quantity: number) => void
}

export function MenuSection({
  menu,
  categoryNames = ['Bebidas', 'Bagels', 'Desayunos', 'Promociones', 'Otros'],
  isLoading = true,
  selectedCategory,
  onSelectCategory,
  onAddToOrder,
}: MenuSectionProps) {
  // Find the products for the selected category
  const productsToShow = React.useMemo(() => {
    if (!menu || !selectedCategory) {
      return []
    }
    return menu.find((category) => category.name === selectedCategory)?.items ?? []
  }, [menu, selectedCategory])

  if (isLoading) {
    return (
      <div
        className="space-y-4 rounded-[1.5rem] border p-6 shadow-[0_20px_50px_rgba(45,33,29,0.06)]"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <div className="mb-6 flex justify-center gap-10 border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
          {categoryNames.map((cat) => (
            <Skeleton key={cat} className="h-10 w-24 rounded-lg" />
          ))}
        </div>

        {/* Products Grid Skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-slate-200">
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
    <div
      className="space-y-4 rounded-[1.5rem] border p-6 shadow-[0_20px_50px_rgba(45,33,29,0.06)]"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="mb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex justify-center gap-4 overflow-x-auto">
          {categoryNames.map((cat) => (
          <button
            key={cat}
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
      {/* Products Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {productsToShow.length === 0 && !isLoading && (
          <div className="col-span-full py-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>
            No hay productos en esta categoría.
          </div>
        )}
        {productsToShow.map((product) => (
          <ProductCard key={product.id} product={product} onAddToOrder={onAddToOrder} />
        ))}
      </div>
    </div>
  )
}

interface ProductCardProps {
  product: MenuItem
  onAddToOrder?: (product: MenuItem, quantity: number) => void
}

function ProductCard({ product, onAddToOrder }: ProductCardProps) {
  const imageUrl = product.imageUrl
    ? getSupabaseImageUrl(product.imageUrl, 'Img', 'public')
    : undefined;

  return (
    <button
      onClick={() => onAddToOrder?.(product, 1)}
      className="group block overflow-hidden rounded-xl border text-left transition-shadow hover:shadow-lg"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="relative h-32 overflow-hidden" style={{ backgroundColor: 'var(--color-background)' }}>
        {imageUrl && (
          <img src={imageUrl} alt={product.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        )}
      </div>
      <div className="p-4">
        <h4 className="mb-1 font-semibold" style={{ color: 'var(--color-text-primary)' }}>{product.name}</h4>
        <div className="flex items-baseline justify-between">
          <span className="text-base font-bold" style={{ color: 'var(--color-primary)' }}>${product.price.toFixed(2)}</span>
        </div>
      </div>
    </button>
  )
}
