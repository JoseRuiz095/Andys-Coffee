import { describe, expect, it } from 'vitest'
import { recipeCost, recipeRowsError, rowsToInput } from './recipeDraft'
import type { RecipeDraftRow } from '../types/recipe.types'

const row = (ingredientId: string, quantity: string, averageCost: number, temperature: RecipeDraftRow['temperature']): RecipeDraftRow => ({
  key: `${ingredientId}-${temperature}`,
  ingredientId,
  ingredientName: ingredientId,
  baseUnitId: 'u',
  baseUnit: 'ml',
  averageCost,
  ingredientActive: true,
  quantity,
  unitId: 'u',
  temperature,
})

// Recipes per temperature (2026-11-16): a Latte sold hot and cold.
const latte = [
  row('cafe', '12', 0.25, 'BOTH'),
  row('leche', '300', 0.0283, 'HOT'),
  row('leche', '250', 0.0283, 'COLD'),
  row('hielo', '160', 0.00105, 'COLD'),
]

describe('recipe draft per temperature', () => {
  it('costs each version with its lines plus the shared ones', () => {
    expect(recipeCost(latte, undefined, 'HOT')).toBe(11.49) // 3 + 8.49
    expect(recipeCost(latte, undefined, 'COLD')).toBe(10.24) // 3 + 7.075 + 0.168
  })

  it('allows the same ingredient once per temperature, not twice in the same one', () => {
    expect(recipeRowsError(latte, false)).toBeNull()
    expect(recipeRowsError([...latte, row('leche', '10', 0, 'HOT')], false)).toMatch(/repetido/)
  })

  it('sends the temperature only for hot or cold lines', () => {
    expect(rowsToInput(latte)).toEqual([
      { ingredientId: 'cafe', quantity: 12 },
      { ingredientId: 'leche', quantity: 300, temperature: 'HOT' },
      { ingredientId: 'leche', quantity: 250, temperature: 'COLD' },
      { ingredientId: 'hielo', quantity: 160, temperature: 'COLD' },
    ])
  })
})
