export type OrderStatus =
  | 'PENDING'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'REJECTED';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  image?: string;
  quantity: number;
  extras: string[];
  notes?: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  createdAt: string;
  status: OrderStatus;
  customer?: {
    name: string;
  };
  items: OrderItem[];
}

