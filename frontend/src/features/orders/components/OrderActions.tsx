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
}

const Button = ({ onClick, className, children, ariaLabel, bgVar, hoverVar }: { onClick: () => void; className: string; children: React.ReactNode; ariaLabel?: string; bgVar: string; hoverVar: string }) => (
  <button
    onClick={onClick}
    className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 text-white ${className}`}
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

export function OrderActions({ order, onStatusChange, currentUser }: OrderActionsProps) {
  const frontendStatus = mapOrderStatusToFrontend(order.status as BackendOrderStatus);
  const canCancelOrder = hasPermission(currentUser, 'sales.cancel');
  useTheme();

  return (
    <div className="flex gap-2">
      {frontendStatus === 'PENDING' && (
        <>
          <Button
            onClick={() => onStatusChange('PREPARING')}
            className="text-xs px-2 py-1"
            bgVar="--color-primary"
            hoverVar="--color-primary-hover"
            ariaLabel={`Marcar orden #${order.orderNumber} como Preparando`}
          >
            Preparando
          </Button>
          {canCancelOrder && (
            <Button
              onClick={() => onStatusChange('CANCELLED')}
              className="text-xs px-2 py-1"
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
