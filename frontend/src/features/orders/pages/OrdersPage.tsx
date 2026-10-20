import { useState, useRef, useEffect } from 'react';
import { OrdersHeader } from '../components/OrdersHeader';
import { OrderStatus } from '../types/orders.types';
import { OrderStatus as BackendOrderStatus } from '../types/backend.types';
import { OrdersGridView } from '../components/grid/OrdersGridView';
import { OrderListView } from '../components/OrderListView';
import { OrdersFilters } from '../components/OrdersFilters';
import { MaximizeIcon } from '../../../components/ui/MaximizeIcon';
import { useOrders } from '../hooks/useOrders';
import { TableSkeleton } from '../../../shared/components/TableSkeleton';
import { authStore } from '../../auth/store/auth.store';
import type { AuthUser } from '../../auth/types/auth.types';
import { CancelOrderDialog } from '../components/CancelOrderDialog';
import { CancellationRequestsPanel } from '../components/CancellationRequestsPanel';
import {
  usePendingCancellationRequests,
  useRequestOrderCancellation,
  useReviewOrderCancellation,
} from '../hooks/useCancellationRequests';
import { hasPermission } from '../../auth/utils/permissions';

type ViewMode = 'grid' | 'list';

export function OrdersPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(authStore.getState().user);

  const {
    orders,
    loading,
    error,
    updateStatus,
    updatingOrderId,
    setSearch,
    setStatus,
  } = useOrders();

  useEffect(() => {
    const handleAuthChange = () => {
      setCurrentUser(authStore.getState().user);
    };
    window.addEventListener('auth:changed', handleAuthChange);
    return () => window.removeEventListener('auth:changed', handleAuthChange);
  }, []);

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  // Order waiting for the cashier to confirm its cancellation.
  const [orderToCancel, setOrderToCancel] = useState<{ id: string; orderNumber: number | string; completed: boolean } | null>(null);
  const canApproveCancellation = hasPermission(currentUser, 'sales.approve_cancellation');
  const { data: pendingCancellations = [] } = usePendingCancellationRequests(canApproveCancellation);
  const requestCancellation = useRequestOrderCancellation();
  const reviewCancellation = useReviewOrderCancellation();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    // Map frontend status strings to lowercase backend status
    const statusMap: Record<OrderStatus, BackendOrderStatus> = {
      'PENDING': 'pending',
      'PREPARING': 'preparing',
      'READY': 'ready',
      'COMPLETED': 'completed',
      'CANCELLED': 'cancelled',
    };

    const backendStatus = statusMap[newStatus];
    if (!backendStatus) return;

    // Cancelling reverses cash and inventory and can't be undone: confirm first.
    if (backendStatus === 'cancelled') {
      const order = orders.find((candidate) => candidate.id === orderId);
      setOrderToCancel({ id: orderId, orderNumber: order?.orderNumber ?? '', completed: order?.status === 'completed' });
      return;
    }

    updateStatus(orderId, backendStatus);
  };

  const handleConfirmCancel = (reason: string | undefined) => {
    if (!orderToCancel) return;
    // A completed sale goes through an approval request (approved at once for an approver).
    if (orderToCancel.completed) {
      if (!reason || requestCancellation.isPending) return;
      requestCancellation.mutate({ orderId: orderToCancel.id, reason }, { onSuccess: () => setOrderToCancel(null) });
      return;
    }
    updateStatus(orderToCancel.id, 'cancelled', { reason, onSuccess: () => setOrderToCancel(null) });
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
      className="space-y-6 p-6"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: isFullScreen ? 'none' : '1px solid var(--color-border)',
        borderRadius: isFullScreen ? undefined : '1.5rem',
        boxShadow: isFullScreen ? 'none' : '0 20px 50px rgba(45,33,29,0.06)',
      }}
    >
      <OrdersHeader pendingOrders={pendingOrders} />

      {canApproveCancellation && (
        <CancellationRequestsPanel
          requests={pendingCancellations}
          reviewingId={reviewCancellation.isPending ? reviewCancellation.variables?.requestId ?? null : null}
          onReview={(request, decision, comment) => {
            if (reviewCancellation.isPending) return;
            reviewCancellation.mutate({ requestId: request.id, decision, comment });
          }}
        />
      )}

      <OrdersFilters
        onSearchChange={setSearch}
        onStatusChange={(status) => setStatus(status ? (status as BackendOrderStatus) : undefined)}
      />

      <div className="flex justify-end gap-2">
        <button
          onClick={toggleFullScreen}
          className="p-2 rounded-lg border"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
          aria-label={isFullScreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          title={isFullScreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
        >
          <MaximizeIcon className="h-5 w-5" style={{ color: 'var(--color-text-primary)' }} />
        </button>
        <button
          onClick={() => setViewMode('grid')}
          className="px-4 py-2 rounded-lg text-sm font-semibold border"
          style={{
            backgroundColor: viewMode === 'grid' ? 'var(--color-primary)' : 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            color: viewMode === 'grid' ? 'var(--color-button-text)' : 'var(--color-text-primary)',
          }}
          aria-label="Ver órdenes en modo cuadrícula"
          aria-pressed={viewMode === 'grid'}
        >
          Grid
        </button>
        <button
          onClick={() => setViewMode('list')}
          className="px-4 py-2 rounded-lg text-sm font-semibold border"
          style={{
            backgroundColor: viewMode === 'list' ? 'var(--color-primary)' : 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            color: viewMode === 'list' ? 'var(--color-button-text)' : 'var(--color-text-primary)',
          }}
          aria-label="Ver órdenes en modo lista"
          aria-pressed={viewMode === 'list'}
        >
          Lista
        </button>
      </div>

      {loading ? (
        <TableSkeleton rows={6} columns={5} />
      ) : error ? (
        <div className="text-red-500 text-center">{error}</div>
      ) : viewMode === 'grid' ? (
        <OrdersGridView orders={orders} onStatusChange={handleStatusChange} currentUser={currentUser} updatingOrderId={updatingOrderId} />
      ) : (
        <OrderListView orders={orders} onStatusChange={handleStatusChange} currentUser={currentUser} updatingOrderId={updatingOrderId} />
      )}

      <CancelOrderDialog
        key={orderToCancel?.id ?? 'none'}
        isOpen={Boolean(orderToCancel)}
        orderNumber={orderToCancel?.orderNumber ?? null}
        mode={orderToCancel?.completed ? (canApproveCancellation ? 'approve-own' : 'request') : 'cancel'}
        isLoading={Boolean(orderToCancel) && (updatingOrderId === orderToCancel?.id || requestCancellation.isPending)}
        onConfirm={handleConfirmCancel}
        onCancel={() => setOrderToCancel(null)}
      />
    </div>
  );
}

