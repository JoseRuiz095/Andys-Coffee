import { getSupabaseImageUrl } from '../../../shared/utils/imageUtils';
import type { Order, OrderStatus } from '../types/orders.types'
import { OrderActions } from './OrderActions'

interface OrderCardProps {
  order: Order
  onStatusChange: (id: string, status: OrderStatus) => void
  isNew?: boolean
}

const statusStyles: Record<OrderStatus, { text: string; bg: string; color: string }> = {
  PENDING: { text: 'Pendiente', bg: 'bg-yellow-100', color: 'text-yellow-800' },
  PREPARING: { text: 'En preparación', bg: 'bg-blue-100', color: 'text-blue-800' },
  READY: { text: 'Lista para recoger', bg: 'bg-green-100', color: 'text-green-800' },
  COMPLETED: { text: 'Completada', bg: 'bg-gray-100', color: 'text-gray-800' },
  REJECTED: { text: 'Rechazada', bg: 'bg-red-100', color: 'text-red-800' },
}

export function OrderCard({ order, onStatusChange, isNew }: OrderCardProps) {
  const { text, bg, color } = statusStyles[order.status]

  return (
    <div className="overflow-hidden rounded-xl border border-[#E7E3DC] bg-white shadow-md transition-shadow hover:shadow-lg">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#2C211D]">
            Orden #{order.orderNumber}
          </h3>
          <div className="flex items-center gap-3">
            {isNew && (
              <span className="rounded-full bg-[#5A804F] px-3 py-1 text-xs font-bold text-white">
                NUEVA
              </span>
            )}
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${bg} ${color}`}>
              {text}
            </span>
          </div>
        </div>
        <p className="text-sm text-[#6B7280]">
          {new Date(order.createdAt).toLocaleString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>

      <div className="border-t border-[#E7E3DC] p-5">
        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-start gap-4">
              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-[#F2EFE8]">
                {item.image && (
                  <img
                    src={getSupabaseImageUrl(item.image, 'Img', 'public')}
                    alt={item.productName}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-[#2C211D]">
                  {item.quantity}x {item.productName}
                </p>
                {item.extras && item.extras.length > 0 && (
                  <p className="text-sm text-[#6B7280]">
                    {item.extras.join(', ')}
                  </p>
                )}
                {item.notes && (
                  <p className="text-sm text-[#6B7280]">Nota: {item.notes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[#E7E3DC] p-5">
        <OrderActions
          order={order}
          onStatusChange={(status) => onStatusChange(order.id, status)}
        />
      </div>
    </div>
  )
}
