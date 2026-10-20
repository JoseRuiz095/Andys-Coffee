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
}

export interface ExtraInput {
  name: string
  description?: string | null
  price: number
  cost: number
}
