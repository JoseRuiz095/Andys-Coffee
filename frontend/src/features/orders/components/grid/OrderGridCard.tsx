import type { Order, OrderStatus } from '../../types/orders.types';
import {
  TIMER_LEVEL_COLOR,
  formatElapsed,
  getElapsedSeconds,
  getOrderSizeRule,
  getTimerLevel,
  isOrderBeingPrepared,
  type TimerLevel,
} from '../../utils/orderTimer';
import { OrderActions } from '../OrderActions';
import { mapOrderStatusToFrontend } from '../../types/orders.types';
import { OrderStatus as BackendOrderStatus } from '../../types/backend.types';
import type { AuthUser } from '../../../auth/types/auth.types';
import { StatusBadge } from '@/shared/components/StatusBadge';

interface OrderGridCardProps {
  order: Order;
  /** Shared clock (ms) from the board, so every card ticks at the same time. */
  now: number;
  onStatusChange: (id: string, status: OrderStatus) => void;
  currentUser: AuthUser | null;
  isUpdating?: boolean;
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

const timerLevelTextMap: Record<TimerLevel, string> = {
  ok: 'A tiempo',
  warning: 'Por vencer',
  late: 'Atrasada',
};

export function OrderGridCard({ order, now, onStatusChange, currentUser, isUpdating = false }: OrderGridCardProps) {
  const sizeRule = getOrderSizeRule(order);
  const isRunning = isOrderBeingPrepared(order);
  const elapsedSeconds = getElapsedSeconds(order.createdAt, now);
  const timerLevel = getTimerLevel(elapsedSeconds, sizeRule.targetMinutes);
  // Once the order is ready the wait is over: the timer stops counting against it.
  const timerColor = isRunning ? TIMER_LEVEL_COLOR[timerLevel] : 'var(--color-success)';

  const frontendStatus = mapOrderStatusToFrontend(order.status as BackendOrderStatus);
  const statusText = statusTextMap[frontendStatus];
  const statusTone = statusToneMap[frontendStatus];

  return (
    <div
      className="flex h-full flex-col rounded-xl border p-4 shadow-md"
      style={{
        borderColor: isRunning && timerLevel !== 'ok' ? timerColor : 'var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}
    >
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
            <span className="font-medium">{Number(item.quantity)}x {item.productName}</span>
            {item.notes && (
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Nota: {item.notes}</span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 text-center">
        {isRunning ? (
          <>
            <p className="text-3xl font-bold tabular-nums" style={{ color: timerColor }}>
              {formatElapsed(elapsedSeconds)}
            </p>
            <p className="text-sm font-semibold" style={{ color: timerColor }}>
              {timerLevelTextMap[timerLevel]}
            </p>
          </>
        ) : (
          <p className="text-2xl font-bold" style={{ color: timerColor }}>
            Lista para entregar
          </p>
        )}
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {sizeRule.label} · meta {sizeRule.targetMinutes} min
        </p>
      </div>

       <div className="border-t mt-4 pt-4" style={{ borderColor: 'var(--color-border)' }}>
        <OrderActions
          order={order}
          onStatusChange={(status) => onStatusChange(order.id, status)}
          currentUser={currentUser}
          isUpdating={isUpdating}
        />
      </div>
    </div>
  );
}
