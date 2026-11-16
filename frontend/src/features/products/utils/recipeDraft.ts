import type { InventoryUnit } from '../../inventory/api/inventory.api'
import type { RecipeDraftRow, RecipeLineInput, RecipeSummary, RecipeTemperature } from '../types/recipe.types'

let rowCounter = 0
const nextKey = () => `row-${++rowCounter}`

export const EMPTY_PRODUCT_RECIPE = { REGULAR: [] as RecipeDraftRow[], JUMBO: [] as RecipeDraftRow[] }

/** Editable rows from a stored recipe (quantities shown in the base unit). */
export function rowsFromRecipe(summary: RecipeSummary | undefined): RecipeDraftRow[] {
  return (summary?.lines ?? []).map((line) => ({
    key: nextKey(),
    ingredientId: line.ingredientId,
    ingredientName: line.ingredientName,
    baseUnitId: line.unitId,
    baseUnit: line.unit,
    averageCost: line.averageCost,
    ingredientActive: line.ingredientActive,
    quantity: String(line.quantity),
    unitId: line.unitId,
    temperature: line.temperature ?? 'BOTH',
  }))
}

export function newRow(ingredient: {
  id: string
  name: string
  averageCost: number | string
  isActive?: boolean
  unit: { id: string; abbreviation: string }
}): RecipeDraftRow {
  return {
    key: nextKey(),
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    baseUnitId: ingredient.unit.id,
    baseUnit: ingredient.unit.abbreviation,
    averageCost: Number(ingredient.averageCost),
    ingredientActive: ingredient.isActive ?? true,
    quantity: '',
    unitId: ingredient.unit.id,
    temperature: 'BOTH',
  }
}

/** Copies rows (e.g. Regular → Jumbo) scaling the quantities. */
export function copyRows(rows: RecipeDraftRow[], factor: number): RecipeDraftRow[] {
  return rows.map((row) => {
    const quantity = Number(row.quantity)
    return {
      ...row,
      key: nextKey(),
      quantity: row.quantity === '' || !Number.isFinite(quantity) ? row.quantity : String(Math.round(quantity * factor * 10000) / 10000),
    }
  })
}

const factorOf = (units: InventoryUnit[] | undefined, unitId: string) =>
  Number(units?.find((unit) => unit.id === unitId)?.factor ?? 1)

/** Quantity of the row in the ingredient's base unit (NaN while the input is not a number). */
export function baseQuantity(row: RecipeDraftRow, units: InventoryUnit[] | undefined) {
  const quantity = Number(row.quantity)
  if (row.quantity.trim() === '' || !Number.isFinite(quantity)) return Number.NaN
  return (quantity * factorOf(units, row.unitId)) / factorOf(units, row.baseUnitId)
}

export function rowCost(row: RecipeDraftRow, units: InventoryUnit[] | undefined) {
  const quantity = baseQuantity(row, units)
  return Number.isFinite(quantity) ? quantity * row.averageCost : 0
}

/**
 * Cost of a recipe. For a product sold hot and cold pass the temperature: its lines plus the
 * BOTH ones (the other temperature's lines are never consumed together with these).
 */
export function recipeCost(rows: RecipeDraftRow[], units: InventoryUnit[] | undefined, temperature?: Exclude<RecipeTemperature, 'BOTH'>) {
  const applicable = temperature ? rows.filter((row) => row.temperature === 'BOTH' || row.temperature === temperature) : rows
  return Math.round(applicable.reduce((total, row) => total + rowCost(row, units), 0) * 100) / 100
}

/** Units the row can be captured in: the same dimension as the ingredient's base unit. */
export function compatibleUnits(row: RecipeDraftRow, units: InventoryUnit[] | undefined) {
  const base = units?.find((unit) => unit.id === row.baseUnitId)
  if (!base) return units?.filter((unit) => unit.id === row.baseUnitId) ?? []
  return units!.filter((unit) => unit.dimension === base.dimension)
}

/**
 * First problem of the rows, or null. `allowNegative` is for extras (they may subtract an
 * ingredient); product recipes need positive quantities.
 */
export function recipeRowsError(rows: RecipeDraftRow[], allowNegative: boolean): string | null {
  const seen = new Set<string>()
  for (const row of rows) {
    const key = `${row.ingredientId}:${row.temperature}`
    if (seen.has(key)) return `"${row.ingredientName}" está repetido${row.temperature === 'BOTH' ? '' : ' en la misma temperatura'}.`
    seen.add(key)
    const quantity = Number(row.quantity)
    if (row.quantity.trim() === '' || !Number.isFinite(quantity)) return `Captura la cantidad de "${row.ingredientName}".`
    if (quantity === 0) return `La cantidad de "${row.ingredientName}" no puede ser cero.`
    if (!allowNegative && quantity < 0) return `La cantidad de "${row.ingredientName}" debe ser mayor a cero.`
  }
  return null
}

export function rowsToInput(rows: RecipeDraftRow[]): RecipeLineInput[] {
  return rows.map((row) => ({
    ingredientId: row.ingredientId,
    quantity: Number(row.quantity),
    ...(row.unitId !== row.baseUnitId && { unitId: row.unitId }),
    ...(row.temperature !== 'BOTH' && { temperature: row.temperature }),
  }))
}
