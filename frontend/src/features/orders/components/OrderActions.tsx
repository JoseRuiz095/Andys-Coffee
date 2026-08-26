import type { Order, OrderStatus } from '../types/orders.types'

interface OrderActionsProps {
  order: Order
  onStatusChange: (status: OrderStatus) => void
}

const Button = ({ onClick, className, children }: { onClick: () => void; className: string; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${className}`}
  >
    {children}
  </button>
)

export function OrderActions({ order, onStatusChange }: OrderActionsProps) {
  if (order.status === 'PENDING') {
    return (
      <div className="flex gap-3">
        <Button onClick={() => onStatusChange('REJECTED')} className="bg-red-500 text-white hover:bg-red-600">
          Rechazar
        </Button>
        <Button onClick={() => onStatusChange('PREPARING')} className="bg-green-500 text-white hover:bg-green-600">
          Aceptar
        </Button>
      </div>
    )
  }

  if (order.status === 'PREPARING') {
    return (
      <Button onClick={() => onStatusChange('READY')} className="bg-blue-500 text-white hover:bg-blue-600">
        Marcar como lista
      </Button>
    )
  }

  if (order.status === 'READY') {
    return (
      <Button onClick={() => onStatusChange('COMPLETED')} className="bg-gray-500 text-white hover:bg-gray-600">
        Marcar como entregada
      </Button>
    )
  }

  return null
}
