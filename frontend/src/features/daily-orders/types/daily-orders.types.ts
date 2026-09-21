export interface DailyOrderItemExtra {
  id: string;
  extraId: string | null;
  extraName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface DailyOrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  notes: string | null;
  extras: DailyOrderItemExtra[];
}

export interface DailyOrderPayment {
  id: string;
  method: string;
  amount: number;
  status: string;
}

export type DailyOrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export interface DailyOrder {
  id: string;
  orderNumber: string;
  status: DailyOrderStatus;
  customerName: string | null;
  notes: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  hasDelivery: boolean;
  deliveryAmount: number;
  deliveryResponsible: 'customer_to_courier' | 'customer_to_business' | 'business_absorbs' | null;
  deliveryPaymentMethod: 'cash' | 'transfer' | null;
  deliveryHandedOff: boolean;
  deliveryHandedOffAt: string | null;
  receivedAmount: number | null;
  changeAmount: number | null;
  createdAt: string;
  completedAt: string | null;
  createdBy: { id: string; name: string } | null;
  items: DailyOrderItem[];
  payments: DailyOrderPayment[];
}
