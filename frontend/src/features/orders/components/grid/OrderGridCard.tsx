import { useState, useEffect } from 'react';
import type { Order, OrderStatus } from '../../types/orders.types';
import { OrderActions } from '../OrderActions';
import { mapOrderStatusToFrontend } from '../../types/orders.types';
import { OrderStatus as BackendOrderStatus } from '../../types/backend.types';
import type { AuthUser } from '../../../auth/types/auth.types';
import { StatusBadge } from '@/shared/components/StatusBadge';

interface OrderGridCardProps {
  order: Order;
  onStatusChange: (id: string, status: OrderStatus) => void;
  currentUser: AuthUser | null;
}

const statusTextMap: Record<OrderStatus, string> = {
  PENDING: 'Pendiente',
  PREPARING: 'En preparación',
  READY: 'Lista',
  COMPLETED: 'Entregada',
  CANCELLED: 'Cancelada',
};

const statusToneMap: Record<OrderStatus, 'warning' | 'info' | 'success' | 'neutral' | 'danger'> = {
  PENDING: 'warning',
  PREPARING: 'info',
  READY: 'success',
  COMPLETED: 'neutral',
  CANCELLED: 'danger',
};

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function OrderGridCard({ order, onStatusChange, currentUser }: OrderGridCardProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(
    (new Date().getTime() - new Date(order.createdAt).getTime()) / 1000
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(
        (new Date().getTime() - new Date(order.createdAt).getTime()) / 1000
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [order.createdAt]);

  const timeStyle = { color: elapsedSeconds > 300 ? 'var(--color-danger)' : 'var(--color-text-primary)' };

  const frontendStatus = mapOrderStatusToFrontend(order.status as BackendOrderStatus);
  const statusText = statusTextMap[frontendStatus];
  const statusTone = statusToneMap[frontendStatus];

  return (
    <div className="flex h-full flex-col rounded-xl border p-4 shadow-md" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Orden #{order.orderNumber}
          {order.customerName && (
            <span className="ml-2 text-base font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              ({order.customerName})
            </span>
          )}
        </h3>
        <StatusBadge tone={statusTone}>{statusText}</StatusBadge>
      </div>

      <div className="flex-1 space-y-2 text-base overflow-y-auto pr-2"> {/* Increased font size and added scroll */}
        {order.items.map((item) => (
          <div key={item.id} className="flex flex-col">
            <span className="font-medium">{item.quantity}x {item.productName}</span>
            {item.notes && (
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Nota: {item.notes}</span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 text-center">
        <p className="text-3xl font-bold" style={timeStyle}> {/* Reduced font size and moved */}
          {formatDuration(Math.round(elapsedSeconds))}
        </p>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>minutos</p>
      </div>

       <div className="border-t mt-4 pt-4" style={{ borderColor: 'var(--color-border)' }}>
        <OrderActions
          order={order}
          onStatusChange={(status) => onStatusChange(order.id, status)}
          currentUser={currentUser}
        />
      </div>
    </div>
  );
}
