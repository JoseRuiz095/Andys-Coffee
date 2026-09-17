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

  return (
    <div className="flex gap-2">
      {frontendStatus === 'PENDING' && (
        <>
          <Button onClick={() => onStatusChange('PREPARING')} className="bg-blue-500 text-white hover:bg-blue-600 text-xs px-2 py-1">
            Preparando
          </Button>
          {canCancelOrder && (
            <Button onClick={() => onStatusChange('CANCELLED')} className="bg-red-500 text-white hover:bg-red-600 text-xs px-2 py-1">
              Cancelar
            </Button>
          )}
        </>
      )}

      {frontendStatus === 'PREPARING' && (
        <>
          <Button onClick={() => onStatusChange('READY')} className="bg-green-500 text-white hover:bg-green-600 text-xs px-2 py-1">
            Lista
          </Button>
          {canCancelOrder && (
            <Button onClick={() => onStatusChange('CANCELLED')} className="bg-red-500 text-white hover:bg-red-600 text-xs px-2 py-1">
              Cancelar
            </Button>
          )}
        </>
      )}

      {frontendStatus === 'READY' && (
        <>
          <Button onClick={() => onStatusChange('COMPLETED')} className="bg-green-600 text-white hover:bg-green-700 text-xs px-2 py-1">
            Entregar
          </Button>
          {canCancelOrder && (
            <Button onClick={() => onStatusChange('CANCELLED')} className="bg-red-500 text-white hover:bg-red-600 text-xs px-2 py-1">
              Cancelar
            </Button>
          )}
        </>
      )}
    </div>
  )
}
