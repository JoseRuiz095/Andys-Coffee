import type { ProductTemperature } from '../../../shared/utils/productTemperature'
import type { ProductRecipe, RecipeLineInput } from './recipe.types'

export interface Product {
  id: string
  categoryId?: string
  name: string
  description?: string
  sku: string
  /** Public URL resolved by the API (null = no image). */
  imageUrl?: string | null
  temperature?: ProductTemperature | null
  jumboPrice?: number | null
  price: number
  cost: number
  isActive: boolean
  displayOrder: number
  /** false = sold without consuming ingredients ("No controla inventario"). */
  tracksInventory: boolean
  /** POS grouping (e.g. family "Latte", variant "Vainilla"). */
  familyId?: string | null
  variantLabel?: string | null
  createdAt: string
  updatedAt: string
}

export interface ProductVariantOption {
  name: string
  value: string
}

/** GET /products/:id: the product with its recipe per size, extras and POS grouping. */
export interface ProductDetail extends Product {
  /** Cost of the regular recipe at current average cost (null = no recipe). */
  suggestedCost: number | string | null
  recipe: ProductRecipe
  /** Extras the POS offers with the product. */
  extras?: { extraId: string; extra: { id: string; name: string } }[]
  family?: { id: string; name: string } | null
  options?: ProductVariantOption[]
}

export interface CreateProductInput {
  categoryId?: string
  temperature?: ProductTemperature | null
  jumboPrice?: number | null
  name: string
  description?: string
  sku: string
  price: number
  cost: number
  displayOrder?: number
  tracksInventory?: boolean
  familyId?: string | null
  variantLabel?: string | null
  /** Each list replaces the stored one when sent. */
  options?: ProductVariantOption[]
  extraIds?: string[]
  /** Ingredients per size; needs inventory.manage_recipes. */
  recipe?: { REGULAR: RecipeLineInput[]; JUMBO?: RecipeLineInput[] }
}

export interface ProductFamily {
  id: string
  name: string
  categoryId: string | null
  displayOrder: number
  isActive: boolean
  _count: { products: number }
}

/** PATCH /products/:id/image: the stored WebP. */
export interface ProductImageUploadResult {
  imageUrl: string
  width: number
  height: number
  bytes: number
  originalBytes: number
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  id: string
}

/** Fields accepted by POST /categories (backend createCategorySchema); isActive defaults to true. */
export type CreateCategoryInput = Pick<Category, 'name' | 'description' | 'imageUrl'> & { displayOrder?: number }

export interface Category {
  id: string
  name: string
  description?: string
  imageUrl?: string
  displayOrder: number
  isActive: boolean
  /** Beverages require a temperature and may have a Jumbo size. */
  isBeverage?: boolean
}
