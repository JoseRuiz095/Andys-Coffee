import { Order, OrderStatus, mapOrderStatusToFrontend } from '../types/orders.types'
import { OrderActions } from './OrderActions'
import { OrderStatus as BackendOrderStatus } from '../types/backend.types';
import type { AuthUser } from '../../auth/types/auth.types';

interface OrderListViewProps {
  orders: Order[]
  onStatusChange: (orderId: string, newStatus: OrderStatus) => void
  currentUser: AuthUser | null
}

const statusStyles: Record<OrderStatus, { text: string; bg: string; color: string }> = {
  PENDING: { text: 'Pendiente', bg: 'bg-yellow-100', color: 'text-yellow-800' },
  PREPARING: { text: 'En preparación', bg: 'bg-blue-100', color: 'text-blue-800' },
  READY: { text: 'Lista', bg: 'bg-green-100', color: 'text-green-800' },
  COMPLETED: { text: 'Entregada', bg: 'bg-gray-100', color: 'text-gray-800' },
  CANCELLED: { text: 'Cancelada', bg: 'bg-red-100', color: 'text-red-800' },
}

export function OrderListView({ orders, onStatusChange, currentUser }: OrderListViewProps) {
  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-xl border shadow-md" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
      <table className="w-full text-sm">
        <thead className="border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <tr>
            <th className="p-4 text-left font-bold" style={{ color: 'var(--color-text-primary)' }}>Orden #</th>
            <th className="p-4 text-left font-bold" style={{ color: 'var(--color-text-primary)' }}>Estado</th>
            <th className="p-4 text-left font-bold" style={{ color: 'var(--color-text-primary)' }}>Hora</th>
            <th className="p-4 text-left font-bold" style={{ color: 'var(--color-text-primary)' }}>Items</th>
            <th className="p-4 text-right font-bold" style={{ color: 'var(--color-text-primary)' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const frontendStatus = mapOrderStatusToFrontend(order.status as BackendOrderStatus);
            const { text, bg, color } = statusStyles[frontendStatus]
            const itemsSummary = order.items
              .map((item) => `${item.quantity}x ${item.productName}`)
              .join(', ')
            const truncatedSummary =
              itemsSummary.length > 50
                ? `${itemsSummary.substring(0, 50)}...`
                : itemsSummary

            return (
              <tr
                key={order.id}
                className="border-b last:border-b-0"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              >
                <td className="p-4 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  #{order.orderNumber}
                </td>
                <td className="p-4">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${bg} ${color}`}
                  >
                    {text}
                  </span>
                </td>
                <td className="p-4" style={{ color: 'var(--color-text-secondary)' }}>
                  {new Date(order.createdAt).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="p-4" style={{ color: 'var(--color-text-primary)' }}>{truncatedSummary}</td>
                <td className="p-4 text-right">
                  <OrderActions
                    order={order}
                    onStatusChange={(status) => onStatusChange(order.id, status)}
                    currentUser={currentUser}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
