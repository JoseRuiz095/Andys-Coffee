import { useState } from 'react'
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue'
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import { useInventoryUnits, useSearchIngredients } from '../../inventory/hooks/useInventory'
import type { RecipeDraftRow } from '../types/recipe.types'
import { compatibleUnits, newRow, recipeCost, rowCost } from '../utils/recipeDraft'

interface RecipeEditorProps {
  rows: RecipeDraftRow[]
  onChange: (rows: RecipeDraftRow[]) => void
  /** Extras may subtract an ingredient (e.g. "sin azúcar"). */
  allowNegative?: boolean
  readOnly?: boolean
  /** Shown under the total, e.g. the product price to compare the cost with. */
  price?: number
  /** Product sold hot and cold: each line says if it is for hot, cold or both. */
  showTemperature?: boolean
}

const TEMPERATURE_LABELS = { BOTH: 'Ambas', HOT: 'Caliente', COLD: 'Frío' } as const

const inputStyle = {
  borderColor: 'var(--color-border)',
  backgroundColor: 'var(--color-input-bg)',
  color: 'var(--color-input-text)',
}

/** Ingredients and quantities of one recipe; quantities can be captured in compatible units. */
export function RecipeEditor({ rows, onChange, allowNegative = false, readOnly = false, price, showTemperature = false }: RecipeEditorProps) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim(), 250)
  const { data: results = [], isFetching } = useSearchIngredients(debouncedSearch)
  const { data: units } = useInventoryUnits()

  // With temperatures an ingredient may appear twice (e.g. milk 300 ml hot and 250 ml cold).
  const usedIds = new Set(showTemperature ? [] : rows.map((row) => row.ingredientId))
  const candidates = results.filter((ingredient) => !usedIds.has(ingredient.id))
  const total = recipeCost(rows, units)
  const hotTotal = recipeCost(rows, units, 'HOT')
  const coldTotal = recipeCost(rows, units, 'COLD')

  const update = (key: string, patch: Partial<RecipeDraftRow>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  const remove = (key: string) => onChange(rows.filter((row) => row.key !== key))

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
          Sin ingredientes todavía.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: 'var(--color-text-secondary)' }}>
              <th className="pb-1 text-left font-medium">Ingrediente</th>
              <th className="pb-1 text-left font-medium">Cantidad</th>
              <th className="pb-1 text-left font-medium">Unidad</th>
              {showTemperature && <th className="pb-1 text-left font-medium">Temperatura</th>}
              <th className="pb-1 text-right font-medium">Costo</th>
              {!readOnly && <th className="pb-1" aria-label="Quitar" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} style={{ borderTop: '1px solid var(--color-border)' }}>
                <td className="py-2 pr-2" style={{ color: 'var(--color-text-primary)' }}>
                  {row.ingredientName}
                  {!row.ingredientActive && (
                    <span className="ml-2 rounded px-1.5 py-0.5 text-xs" style={{ backgroundColor: 'var(--color-warning)', color: 'white' }}>
                      inactivo
                    </span>
                  )}
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min={allowNegative ? undefined : 0}
                    value={row.quantity}
                    disabled={readOnly}
                    onChange={(event) => update(row.key, { quantity: event.target.value })}
                    className="w-24 rounded-lg border px-2 py-1"
                    style={inputStyle}
                    aria-label={`Cantidad de ${row.ingredientName}`}
                  />
                </td>
                <td className="py-2 pr-2">
                  <select
                    value={row.unitId}
                    disabled={readOnly}
                    onChange={(event) => update(row.key, { unitId: event.target.value })}
                    className="rounded-lg border px-2 py-1"
                    style={inputStyle}
                    aria-label={`Unidad de ${row.ingredientName}`}
                  >
                    {compatibleUnits(row, units).map((unit) => (
                      <option key={unit.id} value={unit.id}>{unit.abbreviation}</option>
                    ))}
                    {!units && <option value={row.unitId}>{row.baseUnit}</option>}
                  </select>
                </td>
                {showTemperature && (
                  <td className="py-2 pr-2">
                    <select
                      value={row.temperature}
                      disabled={readOnly}
                      onChange={(event) => update(row.key, { temperature: event.target.value as RecipeDraftRow['temperature'] })}
                      className="rounded-lg border px-2 py-1"
                      style={inputStyle}
                      aria-label={`Temperatura de ${row.ingredientName}`}
                    >
                      {(['BOTH', 'HOT', 'COLD'] as const).map((value) => (
                        <option key={value} value={value}>{TEMPERATURE_LABELS[value]}</option>
                      ))}
                    </select>
                  </td>
                )}
                <td className="py-2 text-right" style={{ color: 'var(--color-text-secondary)' }}>
                  {formatCurrency(rowCost(row, units))}
                </td>
                {!readOnly && (
                  <td className="py-2 pl-2 text-right">
                    <button
                      type="button"
                      onClick={() => remove(row.key)}
                      className="rounded px-2 py-1 text-xs font-semibold"
                      style={{ color: 'var(--color-danger)' }}
                      aria-label={`Quitar ${row.ingredientName}`}
                    >
                      Quitar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!readOnly && (
        <div className="relative">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Agregar ingrediente (escribe al menos 2 letras)…"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
            aria-label="Buscar ingrediente"
          />
          {debouncedSearch.length >= 2 && (
            <ul
              className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border shadow-lg"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
            >
              {isFetching && candidates.length === 0 ? (
                <li className="px-3 py-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Buscando…</li>
              ) : candidates.length === 0 ? (
                <li className="px-3 py-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Sin resultados. Da de alta el insumo en la pestaña Ingredientes.
                </li>
              ) : (
                candidates.map((ingredient) => (
                  <li key={ingredient.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange([...rows, newRow(ingredient)])
                        setSearch('')
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:opacity-80"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      <span>{ingredient.name}</span>
                      <span style={{ color: 'var(--color-text-secondary)' }}>
                        {ingredient.unit.abbreviation} · {formatCurrency(Number(ingredient.averageCost))}/{ingredient.unit.abbreviation}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}

      {(showTemperature
        ? [{ label: 'Costo caliente', value: hotTotal }, { label: 'Costo frío', value: coldTotal }]
        : [{ label: 'Costo al costo promedio actual', value: total }]
      ).map(({ label, value }) => (
        <div key={label} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
          <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {formatCurrency(value)}
            {price !== undefined && price > 0 && (
              <span className="ml-2 font-normal" style={{ color: 'var(--color-text-secondary)' }}>
                · margen {Math.round(((price - value) / price) * 100)}%
              </span>
            )}
          </span>
        </div>
      ))}
      {showTemperature && (
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          "Ambas" se descuenta en las dos versiones; "Caliente" y "Frío", solo en la que se vende.
        </p>
      )}
    </div>
  )
}
