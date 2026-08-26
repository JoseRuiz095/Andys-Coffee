import { OrderStatus as BackendOrderStatus } from "./backend.types";

export type OrderStatus =
  | 'PENDING'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';

export interface OrderItemExtra {
  id: string;
  extraId: string | null;
  extraName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  notes?: string | null;
  extras: OrderItemExtra[];
  product?: {
    imageUrl?: string | null;
  }
}

export interface Payment {
  id: string;
  method: string;
  amount: number;
  status: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  customerName: string | null;
  status: BackendOrderStatus;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  createdAt: string;
  completedAt?: string | null;
  items: OrderItem[];
  payments: Payment[];
}

export interface PaginatedOrders {
  data: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const mapOrderStatusToFrontend = (status: BackendOrderStatus): OrderStatus => {
  switch (status) {
    case 'pending':
      return 'PENDING';
    case 'completed':
      return 'COMPLETED';
    case 'cancelled':
      return 'CANCELLED';
    default:
      return 'PENDING';
  }
};

