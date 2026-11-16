import { useState } from 'react';
import { DailyOrdersTable } from '../components/DailyOrdersTable';
import { DailyOrderDetailDrawer } from '../components/DailyOrderDetailDrawer';
import { useDailyOrders } from '../hooks/useDailyOrders';
import { useCurrentUser } from '../../auth/hooks/useCurrentUser';
import { QueryErrorState } from '../../../shared/components/QueryErrorState';
import { getTodayDateString } from '../../../shared/utils/dateUtils';
import type { DailyOrder } from '../types/daily-orders.types';
import { PageHeader } from '../../../shared/components/PageHeader';
import { FILTER_FIELD_CLASS } from '../../../shared/constants/fieldStyles';

export function DailyOrdersPage() {
  const [date, setDate] = useState(getTodayDateString());
  const [selectedOrder, setSelectedOrder] = useState<DailyOrder | null>(null);
  const currentUser = useCurrentUser();

  const { data: orders, isLoading, isError, error, refetch, isFetching } = useDailyOrders(date);

  const handleResetToToday = () => {
    setDate(getTodayDateString());
  };

  return (
    <div>
      <PageHeader
        title="Órdenes del día"
        description="Todas las órdenes de un día con su estado y forma de pago."
        actions={
          <>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Fecha de las órdenes"
              className={FILTER_FIELD_CLASS}
            />
            <button
              type="button"
              onClick={handleResetToToday}
              className="min-h-10 rounded-lg border px-3 text-sm font-medium transition hover:bg-[var(--color-surface-hover)]"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              Hoy
            </button>
          </>
        }
      />

      {/* Orders Table */}
      {isError ? (
        <QueryErrorState error={error} subject="las órdenes del día" onRetry={() => void refetch()} isRetrying={isFetching} />
      ) : (
        <DailyOrdersTable
          orders={orders ?? []}
          isLoading={isLoading}
          onSelectOrder={setSelectedOrder}
        />
      )}

      {/* Detail Drawer */}
      <DailyOrderDetailDrawer
        isOpen={selectedOrder !== null}
        order={selectedOrder}
        currentUser={currentUser}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
}
