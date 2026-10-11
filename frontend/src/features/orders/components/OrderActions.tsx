import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Order, OrderStatus } from '../types/orders.types'
import { mapOrderStatusToFrontend } from '../types/orders.types'
import { OrderStatus as BackendOrderStatus } from '../types/backend.types'
import type { AuthUser } from '../../auth/types/auth.types'
import { hasPermission } from '../../auth/utils/permissions'
import { useTheme } from '../../../shared/assets/theme'

interface OrderActionsProps {
  order: Order
  onStatusChange: (status: OrderStatus) => void
  currentUser: AuthUser | null
  /** True while this order's status change is being sent: the buttons are locked. */
  isUpdating?: boolean
}

const Button = ({ onClick, className, children, ariaLabel, bgVar, hoverVar, disabled }: { onClick: () => void; className: string; children: ReactNode; ariaLabel?: string; bgVar: string; hoverVar: string; disabled?: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 text-white disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    style={{ backgroundColor: `var(${bgVar})` }}
    onMouseEnter={(e) => {
      e.currentTarget.style.backgroundColor = `var(${hoverVar})`
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = `var(${bgVar})`
    }}
    aria-label={ariaLabel}
    title={ariaLabel}
  >
    {children}
  </button>
)

export function OrderActions({ order, onStatusChange, currentUser, isUpdating = false }: OrderActionsProps) {
  const frontendStatus = mapOrderStatusToFrontend(order.status as BackendOrderStatus);
  const canCancelOrder = hasPermission(currentUser, 'sales.cancel');
  const isScheduled = Boolean(order.scheduledFor) && order.status === 'pending';
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  useEffect(() => {
    if (!isScheduled) return;

    const updateCurrentTime = () => setCurrentTime(Date.now());
    const initialUpdate = window.setTimeout(updateCurrentTime, 0);
    const interval = window.setInterval(updateCurrentTime, 30_000);

    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(interval);
    };
  }, [isScheduled, order.scheduledFor]);

  const scheduledAt = order.scheduledFor ? Date.parse(order.scheduledFor as string) : null;
  const diffMs = scheduledAt !== null && currentTime !== null ? scheduledAt - currentTime : null;
  const canStartPreparing = !isScheduled || (diffMs !== null && diffMs <= 20 * 60 * 1000 && diffMs >= 0);
  useTheme();

  return (
    <div className="flex gap-2">
      {frontendStatus === 'PENDING' && (
        <>
          <Button
            onClick={() => onStatusChange('PREPARING')}
            className="text-xs px-2 py-1"
            disabled={isUpdating || !canStartPreparing}
            bgVar="--color-primary"
            hoverVar="--color-primary-hover"
            ariaLabel={canStartPreparing ? `Marcar orden #${order.orderNumber} como Preparando` : `La orden #${order.orderNumber} aún no puede empezar a prepararse`}
          >
            {isScheduled && !canStartPreparing ? 'Esperando horario' : 'Preparando'}
          </Button>
          {canCancelOrder && (
            <Button
              onClick={() => onStatusChange('CANCELLED')}
              className="text-xs px-2 py-1"
              disabled={isUpdating}
              bgVar="--color-danger"
              hoverVar="--color-danger-hover"
              ariaLabel={`Cancelar orden #${order.orderNumber}`}
            >
              Cancelar
            </Button>
          )}
        </>
      )}

      {frontendStatus === 'PREPARING' && (
        <>
          <Button
            onClick={() => onStatusChange('READY')}
            className="text-xs px-2 py-1"
            disabled={isUpdating}
            bgVar="--color-success"
            hoverVar="--color-success-hover"
            ariaLabel={`Marcar orden #${order.orderNumber} como Lista`}
          >
            Lista
          </Button>
          {canCancelOrder && (
            <Button
              onClick={() => onStatusChange('CANCELLED')}
              className="text-xs px-2 py-1"
              disabled={isUpdating}
              bgVar="--color-danger"
              hoverVar="--color-danger-hover"
              ariaLabel={`Cancelar orden #${order.orderNumber}`}
            >
              Cancelar
            </Button>
          )}
        </>
      )}

      {frontendStatus === 'READY' && (
        <>
          <Button
            onClick={() => onStatusChange('COMPLETED')}
            className="text-xs px-2 py-1"
            disabled={isUpdating}
            bgVar="--color-success"
            hoverVar="--color-success-hover"
            ariaLabel={`Entregar orden #${order.orderNumber}`}
          >
            Entregar
          </Button>
          {canCancelOrder && (
            <Button
              onClick={() => onStatusChange('CANCELLED')}
              className="text-xs px-2 py-1"
              disabled={isUpdating}
              bgVar="--color-danger"
              hoverVar="--color-danger-hover"
              ariaLabel={`Cancelar orden #${order.orderNumber}`}
            >
              Cancelar
            </Button>
          )}
        </>
      )}
    </div>
  )
}
