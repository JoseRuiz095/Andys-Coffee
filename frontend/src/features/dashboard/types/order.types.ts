export interface OrderItem {
  id: string // Unique identifier for the order item instance
  productId: string // Corresponds to Product ID
  productName: string
  quantity: number
  unitPrice: number
  image: string
  note?: string
  modifications?: {
    name: string
    price: number
  }[]
}