import type { MenuExtra, SelectedExtra } from '../types/menu.types'

const MAX_PER_UNIT = 5

interface ExtrasPickerProps {
  extras: MenuExtra[]
  value: SelectedExtra[]
  onChange: (value: SelectedExtra[]) => void
}

/** Steppers to add extras to one unit of a product (the cart multiplies them by its quantity). */
export function ExtrasPicker({ extras, value, onChange }: ExtrasPickerProps) {
  if (extras.length === 0) return null

  const quantityOf = (extraId: string) => value.find((selected) => selected.extraId === extraId)?.quantity ?? 0
  const setQuantity = (extra: MenuExtra, quantity: number) => {
    const others = value.filter((selected) => selected.extraId !== extra.id)
    onChange(quantity > 0 ? [...others, { extraId: extra.id, name: extra.name, price: extra.price, quantity }] : others)
  }

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
        Extras
      </h3>
      <ul className="space-y-2">
        {extras.map((extra) => {
          const quantity = quantityOf(extra.id)
          return (
            <li
              key={extra.id}
              className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
              style={{ borderColor: quantity > 0 ? 'var(--color-primary)' : 'var(--color-border)' }}
            >
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                {extra.name}
                <span className="ml-2" style={{ color: 'var(--color-text-secondary)' }}>+${extra.price.toFixed(2)}</span>
              </span>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Quitar ${extra.name}`}
                  disabled={quantity === 0}
                  onClick={() => setQuantity(extra, quantity - 1)}
                  className="h-8 w-8 rounded-lg border text-lg leading-none disabled:opacity-40"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                >
                  −
                </button>
                <span className="w-5 text-center text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{quantity}</span>
                <button
                  type="button"
                  aria-label={`Agregar ${extra.name}`}
                  disabled={quantity >= MAX_PER_UNIT}
                  onClick={() => setQuantity(extra, quantity + 1)}
                  className="h-8 w-8 rounded-lg border text-lg leading-none disabled:opacity-40"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                >
                  +
                </button>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

