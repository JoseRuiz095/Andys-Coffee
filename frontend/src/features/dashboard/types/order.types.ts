export interface OrderItem {
  id: string // Corresponds to Product ID
  productName: string
  quantity: number
  unitPrice: number
  image: string
  modifications?: {
    name: string
    price: number
  }[]
}