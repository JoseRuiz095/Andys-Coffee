import { Skeleton } from '../../../shared/components/Skeleton'

interface Order {
  id: string
  customerName: string
  orderNumber: string
  status: 'pending' | 'processing' | 'completed' | 'cancelled'
}

interface OrderListSectionProps {
  orders?: Order[]
  isLoading?: boolean
  selectedOrderId?: string
  onSelectOrder?: (orderId: string) => void
}

const statusColors = {
  pending: 'bg-red-100 text-red-700',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-700',
}

const statusLabels = {
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export function OrderListSection({
  orders,
  isLoading = true,
  selectedOrderId,
  onSelectOrder,
}: OrderListSectionProps) {
  if (isLoading) {
    return (
      <div className="rounded-[1.5rem] border border-[#E7E3DC] bg-[#FDFBF7] p-4 shadow-[0_20px_50px_rgba(45,33,29,0.06)]">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-12" />
        </div>

        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-slate-100 p-3">
              <Skeleton className="mb-2 h-4 w-32" />
              <Skeleton className="mb-2 h-3 w-20" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[1.5rem] border border-[#E7E3DC] bg-[#FDFBF7] p-4 shadow-[0_20px_50px_rgba(45,33,29,0.06)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-[#2C211D]">Lista de órdenes</h3>
        <span className="text-xs text-[#6B7280]">Ver todo</span>
      </div>

      <div className="space-y-3">
        {orders?.map((order) => (
          <div
            key={order.id}
            onClick={() => onSelectOrder?.(order.id)}
            className={`cursor-pointer rounded-lg border p-3 transition-colors ${
              selectedOrderId === order.id
                ? 'border-[#5A804F] bg-[#D9E3D6]'
                : 'border-[#E7E3DC] hover:bg-[#F2EFE8]'
            }`}
          >
            <div className="font-medium text-[#2C211D]">{order.customerName}</div>
            <div className="text-xs text-[#6B7280]">
              #{order.orderNumber}
            </div>
            <div className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-medium ${statusColors[order.status]}`}>
              {statusLabels[order.status]}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
