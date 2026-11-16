import { ProductImage } from '../../../shared/components/ProductImage'
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import type { MenuItem, SelectedExtra } from '../types/menu.types'

interface ProductFamilyCardProps {
  title: string
  variants: MenuItem[]
  onOpen?: () => void
}

export function ProductFamilyCard({ title, variants, onOpen }: ProductFamilyCardProps) {
  const mainVariant = variants[0]

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group block overflow-hidden rounded-xl border text-left transition-shadow hover:shadow-lg"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="relative h-32 overflow-hidden" style={{ backgroundColor: 'var(--color-background)' }}>
        <ProductImage src={mainVariant.imageUrl} alt={title} className="transition-transform group-hover:scale-105" />
      </div>
      <div className="p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h4 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{title}</h4>
          <span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}>
            {variants.length} opciones
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-bold" style={{ color: 'var(--color-primary)' }}>{formatCurrency(mainVariant.price)}</span>
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Personalizar</span>
        </div>
      </div>
    </button>
  )
}

interface ProductCardProps {
  product: MenuItem
  onAddToOrder?: (product: MenuItem, quantity: number, extras?: SelectedExtra[]) => void
  /** Called instead of adding right away when the product offers extras. */
  onChooseExtras?: (product: MenuItem) => void
}

export function ProductCard({ product, onAddToOrder, onChooseExtras }: ProductCardProps) {

  return (
    <button
      type="button"
      onClick={() => (product.extras?.length && onChooseExtras ? onChooseExtras(product) : onAddToOrder?.(product, 1))}
      className="group block overflow-hidden rounded-xl border text-left transition-shadow hover:shadow-lg"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="relative h-32 overflow-hidden" style={{ backgroundColor: 'var(--color-background)' }}>
        <ProductImage src={product.imageUrl} alt={product.name} className="transition-transform group-hover:scale-105" />
      </div>
      <div className="p-4">
        <h4 className="mb-1 font-semibold" style={{ color: 'var(--color-text-primary)' }}>{product.name}</h4>
        <div className="flex items-baseline justify-between">
          <span className="text-base font-bold" style={{ color: 'var(--color-primary)' }}>{formatCurrency(product.price)}</span>
        </div>
      </div>
    </button>
  )
}
