import type { ProductCoverage, ProductCoverageVariant } from '../api/inventory.api'

const SIZE_LABELS = { REGULAR: 'Regular', JUMBO: 'Jumbo' } as const
const TEMPERATURE_LABELS = { HOT: 'caliente', COLD: 'frío' } as const

const formatQuantity = (value: number) => value.toLocaleString('es-MX', { maximumFractionDigits: 2 })

function variantLabel(variant: Pick<ProductCoverageVariant, 'size' | 'temperature'>) {
  return [SIZE_LABELS[variant.size], variant.temperature && TEMPERATURE_LABELS[variant.temperature]].filter(Boolean).join(' · ')
}

/** "Alcanza para N": green with stock for a few days of sales, amber when low, red at 0. */
function unitsColor(units: number) {
  if (units <= 0) return 'var(--color-danger)'
  if (units < 10) return 'var(--color-warning)'
  return 'var(--color-success)'
}

interface ProductCoverageCardProps {
  product: ProductCoverage
  onClear: () => void
}

/**
 * Whether the stock completes a product: per size and temperature, how many units its recipe
 * covers and which ingredient runs out first.
 */
export function ProductCoverageCard({ product, onClear }: ProductCoverageCardProps) {
  return (
    <section
      aria-label={`Cobertura de ${product.name}`}
      className="mb-5 rounded-lg border p-4"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>{product.name}</h3>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {product.category ?? 'Sin categoría'} · la tabla muestra solo los insumos de su receta
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg border px-3 py-1.5 text-sm font-medium"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        >
          Ver todos los insumos
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {product.variants.map((variant) => (
          <div
            key={`${variant.size}-${variant.temperature ?? 'any'}`}
            className="rounded-lg border p-3"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
          >
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{variantLabel(variant)}</span>
              <span className="text-sm font-semibold" style={{ color: unitsColor(variant.units) }}>
                {variant.units <= 0 ? 'No alcanza para ninguna' : `Alcanza para ${variant.units}`}
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--color-text-secondary)' }}>
                  <th className="py-1 text-left font-medium">Insumo</th>
                  <th className="py-1 text-right font-medium">Por pieza</th>
                  <th className="py-1 text-right font-medium">Hay</th>
                  <th className="py-1 text-right font-medium">Alcanza</th>
                </tr>
              </thead>
              <tbody>
                {variant.lines.map((line) => {
                  const limiting = variant.limitingIngredientIds.includes(line.ingredientId)
                  return (
                    <tr key={line.ingredientId} style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
                      <td className="py-1.5" style={limiting ? { fontWeight: 600 } : undefined}>
                        {line.name}
                        {limiting && (
                          <span className="ml-1.5 text-xs font-medium" style={{ color: unitsColor(variant.units) }}>limita</span>
                        )}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{formatQuantity(line.quantity)} {line.unit}</td>
                      <td
                        className="py-1.5 text-right tabular-nums"
                        style={{ color: line.currentStock <= 0 ? 'var(--color-danger)' : undefined }}
                      >
                        {formatQuantity(line.currentStock)} {line.unit}
                      </td>
                      <td className="py-1.5 text-right tabular-nums" style={{ color: unitsColor(line.units) }}>{line.units}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </section>
  )
}
