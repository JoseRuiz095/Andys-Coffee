import type { Order, OrderStatus } from '../types/orders.types'
import { mapOrderStatusToFrontend } from '../types/orders.types'
import { OrderStatus as BackendOrderStatus } from '../types/backend.types'
import type { AuthUser } from '../../auth/types/auth.types'
import { hasPermission } from '../../auth/utils/permissions'


interface OrderActionsProps {
  order: Order
  onStatusChange: (status: OrderStatus) => void
  currentUser: AuthUser | null
}

const Button = ({ onClick, className, children }: { onClick: () => void; className: string; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${className}`}
  >
    {children}
  </button>
)

export function OrderActions({ order, onStatusChange, currentUser }: OrderActionsProps) {
  const frontendStatus = mapOrderStatusToFrontend(order.status as BackendOrderStatus);
  const canCancelOrder = hasPermission(currentUser, 'sales.cancel');

  if (frontendStatus === 'PENDING') {
    return (
      <div className="flex gap-3">
        {canCancelOrder && (
          <Button onClick={() => onStatusChange('CANCELLED')} className="bg-red-500 text-white hover:bg-red-600">
            Cancelar
          </Button>
        )}
        <Button onClick={() => onStatusChange('COMPLETED')} className="bg-green-500 text-white hover:bg-green-600">
          Completar
        </Button>
      </div>
    )
  }

  return null
}
