export interface Product {
  id: string
  categoryId?: string
  name: string
  description?: string
  sku: string
  imageUrl?: string
  price: number
  cost: number
  isActive: boolean
  displayOrder: number
  createdAt: string
  updatedAt: string
}

/** GET /products/:id: the product plus the cost suggested by its recipe (null = no recipe). */
export interface ProductDetail extends Product {
  suggestedCost: number | string | null
}

export interface CreateProductInput {
  categoryId?: string
  name: string
  description?: string
  sku: string
  imageUrl?: string
  price: number
  cost: number
  displayOrder?: number
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  id: string
}

export interface Category {
  id: string
  name: string
  description?: string
  imageUrl?: string
  displayOrder: number
  isActive: boolean
}
