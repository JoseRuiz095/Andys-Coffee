import { useState, useRef, useEffect } from 'react'
import { orders as mockOrders } from '../mocks/orders.mock'
import { OrdersHeader } from '../components/OrdersHeader'
import type { Order, OrderStatus } from '../types/orders.types'
import { OrdersGridView } from '../components/grid/OrdersGridView'
import { OrderListView } from '../components/OrderListView'
import { MaximizeIcon } from '../../../components/ui/MaximizeIcon'

type ViewMode = 'grid' | 'list'

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>(mockOrders)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [isFullScreen, setIsFullScreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    setOrders((prevOrders) =>
      prevOrders.map((order) =>
        order.id === orderId ? { ...order, status: newStatus } : order,
      ),
    )
  }

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullScreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange)
    }
  }, [])

  const pendingOrders = orders.filter(
    (order) => order.status === 'PENDING',
  ).length

  return (
    <div
      ref={containerRef}
      className={`space-y-6 bg-[#FDFBF7] p-6 ${
        isFullScreen
          ? 'h-full'
          : 'rounded-[1.5rem] border border-[#E7E3DC] shadow-[0_20px_50px_rgba(45,33,29,0.06)]'
      }`}
    >
      <OrdersHeader pendingOrders={pendingOrders} />

      <div className="flex justify-end gap-2">
        <button
          onClick={toggleFullScreen}
          className="p-2 rounded-lg bg-white border border-[#E7E3DC]"
        >
          <MaximizeIcon className="h-5 w-5 text-[#2C211D]" />
        </button>
        <button
          onClick={() => setViewMode('grid')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${
            viewMode === 'grid'
              ? 'bg-[#2C211D] text-white'
              : 'bg-white text-[#2C211D] border border-[#E7E3DC]'
          }`}
        >
          Grid
        </button>
        <button
          onClick={() => setViewMode('list')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${
            viewMode === 'list'
              ? 'bg-[#2C211D] text-white'
              : 'bg-white text-[#2C211D] border border-[#E7E3DC]'
          }`}
        >
          Lista
        </button>
      </div>

      {viewMode === 'grid' ? (
        <OrdersGridView orders={orders} onStatusChange={handleStatusChange} />
      ) : (
        <OrderListView orders={orders} onStatusChange={handleStatusChange} />
      )}
    </div>
  )
}

