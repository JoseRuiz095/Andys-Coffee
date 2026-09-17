import { Order, OrderStatus, mapOrderStatusToFrontend } from '../types/orders.types'
import { OrderActions } from './OrderActions'
import { OrderStatus as BackendOrderStatus } from '../types/backend.types';
import type { AuthUser } from '../../auth/types/auth.types';
import { StatusBadge } from '@/shared/components/StatusBadge';

interface OrderListViewProps {
  orders: Order[]
  onStatusChange: (orderId: string, newStatus: OrderStatus) => void
  currentUser: AuthUser | null
}

const statusTextMap: Record<OrderStatus, string> = {
  PENDING: 'Pendiente',
  PREPARING: 'En preparación',
  READY: 'Lista',
  COMPLETED: 'Entregada',
  CANCELLED: 'Cancelada',
}

const statusToneMap: Record<OrderStatus, 'warning' | 'info' | 'success' | 'neutral' | 'danger'> = {
  PENDING: 'warning',
  PREPARING: 'info',
  READY: 'success',
  COMPLETED: 'neutral',
  CANCELLED: 'danger',
}

export function OrderListView({ orders, onStatusChange, currentUser }: OrderListViewProps) {
  if (orders.length === 0) {
    return (
      <div className="rounded-xl border p-8 text-center shadow-md" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>No hay órdenes para mostrar</p>
      </div>
    );
  }

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
            const statusText = statusTextMap[frontendStatus]
            const statusTone = statusToneMap[frontendStatus]
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
                className="border-b last:border-b-0 transition-colors duration-150 hover:opacity-80"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              >
                <td className="p-4 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  #{order.orderNumber}
                </td>
                <td className="p-4">
                  <StatusBadge tone={statusTone}>{statusText}</StatusBadge>
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
