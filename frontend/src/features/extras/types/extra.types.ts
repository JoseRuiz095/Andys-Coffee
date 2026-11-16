import type { RecipeLineInput, RecipeSummary } from '../../products/types/recipe.types'

/** Something sold on top of a product (priced per unit of that product). Money comes as strings. */
export interface Extra {
  id: string
  name: string
  description: string | null
  price: number | string
  cost: number | string
  isActive: boolean
  createdAt: string
  updatedAt: string
  /** How many products offer it. */
  _count: { products: number }
  /** Ingredients it adds (positive) or removes (negative, e.g. "sin azúcar") per unit. */
  recipe: RecipeSummary
}

export interface ExtraInput {
  name: string
  description?: string | null
  price: number
  cost: number
  /** Replaces the stored recipe when sent (needs inventory.manage_recipes). */
  recipe?: RecipeLineInput[]
}
