import type { OrderTemperature } from '../../../shared/utils/productTemperature'
import type { SelectedExtra } from '../../menu/types/menu.types'

export interface OrderItemExtra {
  extraId: string;
  quantity: number;
}

export interface CreateOrderItem {
  productId?: string;
  comboId?: string;
  quantity: number;
  temperature?: OrderTemperature;
  size?: 'JUMBO';
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
  hasDelivery?: boolean;
  deliveryAmount?: number;
  deliveryResponsible?: 'customer_to_courier' | 'customer_to_business' | 'business_absorbs';
  deliveryPaymentMethod?: 'cash' | 'transfer';
  scheduledFor?: string | null;
}

/** Server pricing of a cart (POST /orders/quote). Money comes as two-decimal strings. */
export interface OrderQuote {
  /** One entry per cart line, in the order they were sent. */
  items: { gross: string; discount: string; net: string }[];
  subtotal: string;
  discount: string;
  total: string;
}

/** A line of the POS cart (client-side state; the server prices it). */
export interface OrderItem {
  id: string // Unique identifier for the order item instance
  productId?: string // Corresponds to Product ID
  comboId?: string // Corresponds to Combo ID
  productName: string
  temperature?: OrderTemperature | null
  size?: 'JUMBO'
  quantity: number
  unitPrice: number
  image: string | null // product image URL from the API (null = no image)
  note?: string
  type: 'product' | 'combo'
  /** Extras of each unit of the line (2 lattes with 1 shot = 2 shots). */
  extras?: SelectedExtra[]
  }

