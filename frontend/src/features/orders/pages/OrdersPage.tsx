import { useState, useRef, useEffect } from 'react';
import { OrdersHeader } from '../components/OrdersHeader';
import { OrderStatus } from '../types/orders.types';
import { OrdersGridView } from '../components/grid/OrdersGridView';
import { OrderListView } from '../components/OrderListView';
import { MaximizeIcon } from '../../../components/ui/MaximizeIcon';
import { useOrders } from '../hooks/useOrders';
import { Spinner } from '@/shared/components/Spinner';

type ViewMode = 'grid' | 'list';

export function OrdersPage() {
  const {
    orders,
    loading,
    error,
    updateStatus,
  } = useOrders();

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    // The frontend status needs to be mapped to the backend status
    // For now, let's assume a direct mapping is possible for 'cancelled'.
    // A more robust solution would be a mapping function.
    if (newStatus === 'CANCELLED') {
      updateStatus(orderId, 'cancelled');
    } else if (newStatus === 'COMPLETED') {
      updateStatus(orderId, 'completed');
    }
    // For 'PENDING', 'PREPARING', 'READY' we might not have a direct backend equivalent to change to
    // or the logic is more complex (e.g. can't go back from completed to pending)
    // For now, we only handle 'cancelled' and 'completed'
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
    };
  }, []);

  const pendingOrders = orders.filter(
    (order) => order.status === 'pending'
  ).length;

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

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spinner />
        </div>
      ) : error ? (
        <div className="text-red-500 text-center">{error}</div>
      ) : viewMode === 'grid' ? (
        <OrdersGridView orders={orders} onStatusChange={handleStatusChange} />
      ) : (
        <OrderListView orders={orders} onStatusChange={handleStatusChange} />
      )}
    </div>
  );
}

