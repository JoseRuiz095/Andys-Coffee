import { Order, OrderStatus, mapOrderStatusToFrontend } from '../types/orders.types'
import { OrderActions } from './OrderActions'
import { OrderStatus as BackendOrderStatus } from '../types/backend.types';

interface OrderListViewProps {
  orders: Order[]
  onStatusChange: (orderId: string, newStatus: OrderStatus) => void
}

const statusStyles: Record<OrderStatus, { text: string; bg: string; color: string }> = {
  PENDING: { text: 'Pendiente', bg: 'bg-yellow-100', color: 'text-yellow-800' },
  PREPARING: { text: 'En preparación', bg: 'bg-blue-100', color: 'text-blue-800' },
  READY: { text: 'Lista para recoger', bg: 'bg-green-100', color: 'text-green-800' },
  COMPLETED: { text: 'Completada', bg: 'bg-gray-100', color: 'text-gray-800' },
  CANCELLED: { text: 'Cancelada', bg: 'bg-red-100', color: 'text-red-800' },
}

export function OrderListView({ orders, onStatusChange }: OrderListViewProps) {
  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-xl border border-[#E7E3DC] bg-white shadow-md">
      <table className="w-full text-sm">
        <thead className="border-b border-[#E7E3DC] bg-[#FDFBF7]">
          <tr>
            <th className="p-4 text-left font-bold text-[#2C211D]">Orden #</th>
            <th className="p-4 text-left font-bold text-[#2C211D]">Estado</th>
            <th className="p-4 text-left font-bold text-[#2C211D]">Hora</th>
            <th className="p-4 text-left font-bold text-[#2C211D]">Items</th>
            <th className="p-4 text-right font-bold text-[#2C211D]">Acciones</th>
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
                className="border-b border-[#E7E3DC] last:border-b-0 hover:bg-[#FDFBF7]"
              >
                <td className="p-4 font-medium text-[#2C211D]">
                  #{order.orderNumber}
                </td>
                <td className="p-4">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${bg} ${color}`}
                  >
                    {text}
                  </span>
                </td>
                <td className="p-4 text-[#6B7280]">
                  {new Date(order.createdAt).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="p-4 text-[#2C211D]">{truncatedSummary}</td>
                <td className="p-4 text-right">
                  <OrderActions
                    order={order}
                    onStatusChange={(status) => onStatusChange(order.id, status)}
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
