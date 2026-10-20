import { OrderStatus as BackendOrderStatus } from "./backend.types";
import type { OrderTemperature } from '../../../shared/utils/productTemperature'

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
  temperature: OrderTemperature | null;
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

export type CancellationRequestStatus = 'pending' | 'approved' | 'rejected';

/** Request to cancel a completed sale, approved or rejected by an admin. */
export interface CancellationRequestSummary {
  id: string;
  status: CancellationRequestStatus;
  reason: string;
  reviewComment: string | null;
  createdAt: string;
  reviewedAt: string | null;
  requestedBy: { id: string; name: string };
  reviewedBy: { id: string; name: string } | null;
}

/** A pending request with the sale it is about (approver's list). */
export interface PendingCancellationRequest extends CancellationRequestSummary {
  order: {
    id: string;
    orderNumber: number | string;
    customerName: string | null;
    total: number | string;
    createdAt: string;
    completedAt: string | null;
  };
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
  scheduledFor?: string | null;
  activatedAt?: string | null;
  items: OrderItem[];
  payments: Payment[];
  /** Latest cancellation request (at most one entry). */
  cancellationRequests?: CancellationRequestSummary[];
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
    case 'preparing':
      return 'PREPARING';
    case 'ready':
      return 'READY';
    case 'completed':
      return 'COMPLETED';
    case 'cancelled':
      return 'CANCELLED';
    default:
      return 'PENDING';
  }
};

