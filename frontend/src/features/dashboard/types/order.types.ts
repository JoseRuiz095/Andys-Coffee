export interface OrderItemExtra {
  extraId: string;
  quantity: number;
}

export interface CreateOrderItem {
  productId?: string;
  comboId?: string;
  quantity: number;
  note?: string | null;
  extras?: OrderItemExtra[];
}

export interface CreateOrderPayload {
  customerName?: string | null;
  notes?: string | null;
  cashSessionId?: string;
  items: CreateOrderItem[];
  paymentMethod: string;
  cashReceived?: number;
}

export interface Order {
  id: string;
  orderNumber: number;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  customerName: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes: string | null;
  createdAt: string;
  items: FullOrderItem[];
}

export interface FullOrderItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes: string | null;
  extras: OrderItemExtra[];
}

// This seems to be for UI display, might need to be adjusted
export interface OrderItem {
  id: string // Unique identifier for the order item instance
  productId?: string // Corresponds to Product ID
  comboId?: string // Corresponds to Combo ID
  productName: string
  quantity: number
  unitPrice: number
  image: string
  note?: string
  type: 'product' | 'combo'
  modifications?: {
    name: string
    price: number
  }[]
  }

  export const _ = {};