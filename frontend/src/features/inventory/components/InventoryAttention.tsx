import { useState } from 'react'
import { useLowStock, useProductsWithoutRecipe } from '../hooks/useInventory'

const SIZE_LABELS = { REGULAR: 'regular', JUMBO: 'Jumbo' } as const
/** Items shown per group when expanded; the rest is one click away. */
const PREVIEW_LIMIT = 5

interface InventoryAttentionProps {
  /** Filters the stock table to what needs restocking. */
  onShowLowStock: () => void
  /** Opens Catálogo → Productos, where recipes are captured. */
  onShowProducts: () => void
}

/**
 * One collapsible notice for what needs attention: ingredients at their minimum (or out) and
 * active products without a recipe (their sales can't discount ingredients). Hidden when there
 * is nothing to report.
 */
export function InventoryAttention({ onShowLowStock, onShowProducts }: InventoryAttentionProps) {
  const { data: lowStock = [] } = useLowStock()
  const { data: withoutRecipe = [] } = useProductsWithoutRecipe()
  const [isOpen, setIsOpen] = useState(false)

  if (lowStock.length === 0 && withoutRecipe.length === 0) return null

  const summary = [
    lowStock.length > 0 && `${lowStock.length} insumo(s) en su mínimo o agotados`,
    withoutRecipe.length > 0 && `${withoutRecipe.length} producto(s) sin receta`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section
      className="mb-5 rounded-lg border"
      style={{
        borderColor: 'color-mix(in srgb, var(--color-warning) 45%, var(--color-border))',
        backgroundColor: 'color-mix(in srgb, var(--color-warning) 8%, var(--color-surface))',
      }}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm"
        style={{ color: 'var(--color-text-primary)' }}
      >
        <span className="flex items-center gap-2 font-medium">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0" aria-hidden="true" style={{ color: 'var(--color-warning)' }}>
            <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Requiere atención: {summary}
        </span>
        <span style={{ color: 'var(--color-primary)' }}>{isOpen ? 'Ocultar' : 'Ver'}</span>
      </button>

      {isOpen && (
        <div className="grid gap-4 border-t px-4 py-3 md:grid-cols-2" style={{ borderColor: 'var(--color-border)' }}>
          {lowStock.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Insumos por reponer</h3>
              <ul className="space-y-1 text-sm">
                {lowStock.slice(0, PREVIEW_LIMIT).map((ingredient) => (
                  <li key={ingredient.id} className="flex justify-between gap-3" style={{ color: 'var(--color-text-primary)' }}>
                    <span>{ingredient.name}</span>
                    <span style={{ color: Number(ingredient.currentStock) <= 0 ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                      {Number(ingredient.currentStock).toFixed(2)} / mín. {Number(ingredient.minimumStock).toFixed(2)} {ingredient.unit.abbreviation}
                    </span>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={onShowLowStock} className="mt-2 text-sm font-medium hover:underline" style={{ color: 'var(--color-primary)' }}>
                Ver {lowStock.length > PREVIEW_LIMIT ? `los ${lowStock.length}` : ''} en la tabla
              </button>
            </div>
          )}
          {withoutRecipe.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Productos sin receta</h3>
              <p className="mb-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Sus ventas no descuentan insumos.</p>
              <ul className="space-y-1 text-sm">
                {withoutRecipe.slice(0, PREVIEW_LIMIT).map((product) => (
                  <li key={product.id} style={{ color: 'var(--color-text-primary)' }}>
                    {product.name}
                    <span style={{ color: 'var(--color-text-secondary)' }}> · falta {product.missing.map((size) => SIZE_LABELS[size]).join(' y ')}</span>
                  </li>
                ))}
              </ul>
              {withoutRecipe.length > PREVIEW_LIMIT && (
                <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>y {withoutRecipe.length - PREVIEW_LIMIT} más…</p>
              )}
              <button type="button" onClick={onShowProducts} className="mt-2 text-sm font-medium hover:underline" style={{ color: 'var(--color-primary)' }}>
                Capturar recetas en Catálogo → Productos
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
