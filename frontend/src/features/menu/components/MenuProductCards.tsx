import { ProductImage } from '../../../shared/components/ProductImage'
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import type { MenuItem, SelectedExtra } from '../types/menu.types'

// Whole card is the touch target. Selected (already in the order) cards keep the brand color on
// the border and show how many units the order has.
const cardClassName =
  'group relative flex h-full flex-col overflow-hidden rounded-xl border text-left transition hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-primary)_45%,transparent)]'

const cardStyle = (inOrder: boolean) => ({
  borderColor: inOrder ? 'var(--color-primary)' : 'var(--color-border)',
  backgroundColor: 'var(--color-surface)',
})

/**
 * The menu photos are square cut-outs (cups, bagels). They sit in a square tile centered in the
 * image band and are never cropped, so the product looks the same whatever the card width (a
 * fixed-height band with `object-cover` cut the lid or the base of the cups on wide cards).
 */
function CardImage({ src, alt, quantityInOrder, options }: { src: string | null | undefined; alt: string; quantityInOrder: number; options?: number }) {
  return (
    <div className="relative flex h-28 shrink-0 items-center justify-center p-2" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="aspect-square h-full overflow-hidden rounded-lg" style={{ backgroundColor: 'var(--color-image-tile)' }}>
        <ProductImage src={src} alt={alt} fit="contain" className="transition-transform group-hover:scale-105" />
      </div>
      {options !== undefined && (
        <span
          className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-semibold shadow-sm"
          style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
        >
          {options} opciones
        </span>
      )}
      {quantityInOrder > 0 && (
        <span
          aria-hidden="true"
          className="absolute right-2 top-2 flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-base font-bold shadow-sm"
          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-button-text)' }}
        >
          {quantityInOrder}
        </span>
      )}
    </div>
  )
}

/** Category shown while searching the whole menu. */
function CardCaption({ caption }: { caption?: string }) {
  if (!caption) return null
  return (
    <span className="truncate text-xs" style={{ color: 'var(--color-text-secondary)' }}>
      {caption}
    </span>
  )
}

/** Read by screen readers only: the badge is decorative. */
function InOrderNote({ quantityInOrder }: { quantityInOrder: number }) {
  return quantityInOrder > 0 ? <span className="sr-only">, {quantityInOrder} en la orden</span> : null
}

interface ProductFamilyCardProps {
  title: string
  variants: MenuItem[]
  onOpen?: () => void
  /** Units of any variant already in the order. */
  quantityInOrder?: number
  caption?: string
}

export function ProductFamilyCard({ title, variants, onOpen, quantityInOrder = 0, caption }: ProductFamilyCardProps) {
  const mainVariant = variants[0]
  const pricesDiffer = variants.some((variant) => variant.price !== mainVariant.price)

  return (
    <button type="button" onClick={onOpen} className={cardClassName} style={cardStyle(quantityInOrder > 0)}>
      <CardImage src={mainVariant.imageUrl} alt={title} quantityInOrder={quantityInOrder} options={variants.length} />
      <div className="flex flex-1 flex-col gap-1 p-3">
        <CardCaption caption={caption} />
        <h4 className="line-clamp-2 text-base font-semibold leading-snug" style={{ color: 'var(--color-text-primary)' }}>{title}</h4>
        <span className="mt-auto pt-1 text-xl font-bold tabular-nums" style={{ color: 'var(--color-primary)' }}>
          {pricesDiffer && <span className="mr-1 text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>desde</span>}
          {formatCurrency(mainVariant.price)}
        </span>
      </div>
      <InOrderNote quantityInOrder={quantityInOrder} />
    </button>
  )
}

interface ProductCardProps {
  product: MenuItem
  onAddToOrder?: (product: MenuItem, quantity: number, extras?: SelectedExtra[]) => void
  /** Called instead of adding right away when the product offers extras. */
  onChooseExtras?: (product: MenuItem) => void
  /** Units of this product already in the order. */
  quantityInOrder?: number
  caption?: string
}

export function ProductCard({ product, onAddToOrder, onChooseExtras, quantityInOrder = 0, caption }: ProductCardProps) {
  return (
    <button
      type="button"
      onClick={() => (product.extras?.length && onChooseExtras ? onChooseExtras(product) : onAddToOrder?.(product, 1))}
      className={cardClassName}
      style={cardStyle(quantityInOrder > 0)}
    >
      <CardImage src={product.imageUrl} alt={product.name} quantityInOrder={quantityInOrder} />
      <div className="flex flex-1 flex-col gap-1 p-3">
        <CardCaption caption={caption} />
        <h4 className="line-clamp-2 text-base font-semibold leading-snug" style={{ color: 'var(--color-text-primary)' }}>{product.name}</h4>
        <span className="mt-auto pt-1 text-xl font-bold tabular-nums" style={{ color: 'var(--color-primary)' }}>
          {formatCurrency(product.price)}
        </span>
      </div>
      <InOrderNote quantityInOrder={quantityInOrder} />
    </button>
  )
}
