import { Order, OrderStatus } from '../../types/orders.types';
import { OrderGridCard } from './OrderGridCard';
import type { AuthUser } from '../../../auth/types/auth.types';
import { useNow } from '../../hooks/useNow';
import { sortOrdersByUrgency } from '../../utils/orderTimer';

interface OrdersGridViewProps {
  orders: Order[];
  onStatusChange: (orderId: string, newStatus: OrderStatus) => void;
  currentUser: AuthUser | null;
  updatingOrderId?: string | null;
}

export function OrdersGridView({ orders, onStatusChange, currentUser, updatingOrderId = null }: OrdersGridViewProps) {
  const now = useNow();
  const activeOrders = sortOrdersByUrgency(
    orders.filter(order => order.status !== 'completed' && order.status !== 'cancelled'),
    now,
  );

  if (activeOrders.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-center">
        <p style={{ color: 'var(--color-text-secondary)' }}>No hay órdenes activas</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {activeOrders.map((order) => (
        <OrderGridCard
          key={order.id}
          order={order}
          now={now}
          onStatusChange={onStatusChange}
          currentUser={currentUser}
          isUpdating={updatingOrderId === order.id}
        />
      ))}
    </div>
  );
}
