/** HOT/COLD lines apply only to that temperature; BOTH lines to either (products sold both ways). */
export type RecipeTemperature = 'HOT' | 'COLD' | 'BOTH'

/** Recipe line as the API returns it (quantity in the ingredient's base unit). */
export interface RecipeLine {
  ingredientId: string
  ingredientName: string
  ingredientSku: string | null
  ingredientActive: boolean
  unitId: string
  unit: string
  quantity: number
  averageCost: number
  lineCost: number
  /** Product recipes only. */
  temperature?: RecipeTemperature
}

export interface RecipeSummary {
  lines: RecipeLine[]
  /** Σ quantity × average cost, rounded to cents. */
  cost: number
}

export type ProductSize = 'REGULAR' | 'JUMBO'

/** GET /products/:id → recipe per size. */
export type ProductRecipe = Record<ProductSize, RecipeSummary>

/** What POST/PATCH send: the quantity in `unitId` (converted to the base unit by the server). */
export interface RecipeLineInput {
  ingredientId: string
  quantity: number
  unitId?: string
  /** Omitted = BOTH. */
  temperature?: RecipeTemperature
}

/** One editable row of the recipe editor. */
export interface RecipeDraftRow {
  key: string
  ingredientId: string
  ingredientName: string
  /** Unit the ingredient is stocked in (gr, ml or pz). */
  baseUnitId: string
  baseUnit: string
  averageCost: number
  ingredientActive: boolean
  /** As typed (may be empty or partial while editing). */
  quantity: string
  /** Unit the quantity is captured in (the base unit or a compatible one, e.g. kg). */
  unitId: string
  temperature: RecipeTemperature
}

export type ProductRecipeDraft = Record<ProductSize, RecipeDraftRow[]>
