import { getSupabaseImageUrl } from '../../../shared/utils/imageUtils';
import { mapOrderStatusToFrontend } from '../types/orders.types'
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
  CANCELLED: { text: 'Cancelada', bg: 'bg-red-100', color: 'text-red-800' },
}

export function OrderCard({ order, onStatusChange, isNew }: OrderCardProps) {
  const { text, bg, color } = statusStyles[mapOrderStatusToFrontend(order.status)]

  return (
    <div
      className="overflow-hidden rounded-xl border shadow-md transition-shadow hover:shadow-lg"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
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
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {new Date(order.createdAt).toLocaleString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>

      <div className="border-t p-5" style={{ borderColor: 'var(--color-border)' }}>
        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-start gap-4">
              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg" style={{ backgroundColor: 'var(--color-background)' }}>
                {item.product?.imageUrl && (
                  <img
                    src={getSupabaseImageUrl(item.product.imageUrl, 'Img', 'public')}
                    alt={item.productName}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {item.quantity}x {item.productName}
                </p>
                {item.extras && item.extras.length > 0 && (
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {item.extras.join(', ')}
                  </p>
                )}
                {item.notes && (
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Nota: {item.notes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t p-5" style={{ borderColor: 'var(--color-border)' }}>
        <OrderActions
          order={order}
          onStatusChange={(status) => onStatusChange(order.id, status)}
        />
      </div>
    </div>
  )
}
