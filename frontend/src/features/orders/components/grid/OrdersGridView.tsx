import { Order, OrderStatus } from '../../types/orders.types';
import { OrderGridCard } from './OrderGridCard';

interface OrdersGridViewProps {
  orders: Order[];
  onStatusChange: (orderId: string, newStatus: OrderStatus) => void;
}

export function OrdersGridView({ orders, onStatusChange }: OrdersGridViewProps) {
  const activeOrders = orders.filter(order => order.status === 'pending');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {activeOrders.map((order) => (
        <OrderGridCard
          key={order.id}
          order={order}
          onStatusChange={onStatusChange}
        />
      ))}
    </div>
  );
}
