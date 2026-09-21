import { useEffect, useState } from 'react';
import { DailyOrdersTable } from '../components/DailyOrdersTable';
import { DailyOrderDetailDrawer } from '../components/DailyOrderDetailDrawer';
import { useDailyOrders } from '../hooks/useDailyOrders';
import { authStore } from '../../auth/store/auth.store';
import { getTodayDateString } from '../../../shared/utils/dateUtils';
import type { AuthUser } from '../../auth/types/auth.types';
import type { DailyOrder } from '../types/daily-orders.types';

export function DailyOrdersPage() {
  const [date, setDate] = useState(getTodayDateString());
  const [selectedOrder, setSelectedOrder] = useState<DailyOrder | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(authStore.getState().user);

  const { data: orders, isLoading } = useDailyOrders(date);

  useEffect(() => {
    const handleAuthChanged = () => {
      setCurrentUser(authStore.getState().user);
    };

    window.addEventListener('auth:changed', handleAuthChanged);
    return () => window.removeEventListener('auth:changed', handleAuthChanged);
  }, []);

  const handleResetToToday = () => {
    setDate(getTodayDateString());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Órdenes del Día
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Visualiza y gestiona las órdenes del día
        </p>
      </div>

      {/* Date Picker */}
      <div className="flex items-center gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 rounded-lg border"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
          }}
        />
        <button
          onClick={handleResetToToday}
          className="px-3 py-2 rounded-lg text-sm font-medium transition"
          style={{
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
            border: `1px solid var(--color-border)`,
          }}
        >
          Hoy
        </button>
      </div>

      {/* Orders Table */}
      <DailyOrdersTable
        orders={orders ?? []}
        isLoading={isLoading}
        onSelectOrder={setSelectedOrder}
      />

      {/* Detail Drawer */}
      <DailyOrderDetailDrawer
        isOpen={selectedOrder !== null}
        order={selectedOrder}
        currentUser={currentUser}
        date={date}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
}
