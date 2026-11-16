import { useState } from 'react'
import type { ProductRecipeDraft, ProductSize } from '../types/recipe.types'
import { copyRows } from '../utils/recipeDraft'
import { RecipeEditor } from './RecipeEditor'

interface ProductRecipeSectionProps {
  recipe: ProductRecipeDraft
  onChange: (recipe: ProductRecipeDraft) => void
  tracksInventory: boolean
  onTracksInventoryChange: (value: boolean) => void
  /** A beverage with a Jumbo price: it needs its Jumbo recipe too. */
  jumboAvailable: boolean
  price: number
  jumboPrice: number | null
  /** Without inventory.manage_recipes the recipe is shown but not editable. */
  readOnly: boolean
  /** Sold hot and cold (temperature BOTH): lines can be marked hot or cold. */
  soldBothWays?: boolean
}

const SIZE_LABELS: Record<ProductSize, string> = { REGULAR: 'Regular', JUMBO: 'Jumbo' }

/** Recipe of a product per size (decision D-5: required unless it doesn't track inventory). */
export function ProductRecipeSection({
  recipe,
  onChange,
  tracksInventory,
  onTracksInventoryChange,
  jumboAvailable,
  price,
  jumboPrice,
  readOnly,
  soldBothWays = false,
}: ProductRecipeSectionProps) {
  const [size, setSize] = useState<ProductSize>('REGULAR')
  const [jumboFactor, setJumboFactor] = useState('1.5')
  const activeSize: ProductSize = jumboAvailable ? size : 'REGULAR'
  const sizes: ProductSize[] = jumboAvailable ? ['REGULAR', 'JUMBO'] : ['REGULAR']

  return (
    <fieldset className="space-y-3 rounded-lg border p-4" style={{ borderColor: 'var(--color-border)' }}>
      <legend className="px-1 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        Receta (ingredientes por unidad vendida)
      </legend>

      <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-primary)' }}>
        <input
          type="checkbox"
          checked={!tracksInventory}
          disabled={readOnly}
          onChange={(event) => onTracksInventoryChange(!event.target.checked)}
        />
        No controla inventario (se vende sin descontar insumos)
      </label>

      {tracksInventory && (
        <>
          {sizes.length > 1 && (
            <div className="flex gap-2" role="tablist" aria-label="Tamaño de la receta">
              {sizes.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={activeSize === option}
                  onClick={() => setSize(option)}
                  className="rounded-lg border px-3 py-1 text-sm font-medium"
                  style={{
                    borderColor: activeSize === option ? 'var(--color-primary)' : 'var(--color-border)',
                    backgroundColor: activeSize === option ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {SIZE_LABELS[option]} ({recipe[option].length})
                </button>
              ))}
            </div>
          )}

          {activeSize === 'JUMBO' && !readOnly && (
            <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <span>Copiar la receta Regular ×</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={jumboFactor}
                onChange={(event) => setJumboFactor(event.target.value)}
                className="w-16 rounded-lg border px-2 py-1"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
                aria-label="Factor para la receta Jumbo"
              />
              <button
                type="button"
                disabled={recipe.REGULAR.length === 0 || !(Number(jumboFactor) > 0)}
                onClick={() => onChange({ ...recipe, JUMBO: copyRows(recipe.REGULAR, Number(jumboFactor)) })}
                className="rounded-lg border px-3 py-1 font-medium disabled:opacity-50"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              >
                Copiar
              </button>
              <span className="text-xs">Revisa después vasos y tapas: no se escalan.</span>
            </div>
          )}

          <RecipeEditor
            rows={recipe[activeSize]}
            onChange={(rows) => onChange({ ...recipe, [activeSize]: rows })}
            readOnly={readOnly}
            price={activeSize === 'JUMBO' ? jumboPrice ?? undefined : price}
            showTemperature={soldBothWays}
          />
          {readOnly && (
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Necesitas el permiso para editar recetas.
            </p>
          )}
        </>
      )}
    </fieldset>
  )
}
