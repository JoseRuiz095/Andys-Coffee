import type { ReactNode } from 'react';
import { useDashboardUpcomingPurchases } from '../hooks/useDashboard';
import { Skeleton } from '../../../shared/components/Skeleton';
import { QueryErrorState } from '../../../shared/components/QueryErrorState';
import { DashboardCard, DashboardCardEmpty } from './DashboardCard';
import { formatCurrency } from '../../../shared/utils/formatCurrency';

interface UpcomingInventoryProps {
  limit?: number;
  /** Link to the module with the full list. */
  action?: ReactNode;
}

export function UpcomingInventory({ limit = 10, action }: UpcomingInventoryProps) {
  const { data, isLoading, error, refetch, isFetching } = useDashboardUpcomingPurchases({ limit });

  if (error) {
    return (
      <DashboardCard title="Compras por recibir" action={action}>
        <QueryErrorState error={error} subject="las compras por recibir" onRetry={() => void refetch()} isRetrying={isFetching} />
      </DashboardCard>
    );
  }

  if (isLoading) {
    return (
      <DashboardCard title="Compras por recibir" action={action}>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      </DashboardCard>
    );
  }

  if (!data?.purchases.length) {
    return (
      <DashboardCard title="Compras por recibir" action={action}>
        <DashboardCardEmpty>No hay compras pendientes</DashboardCardEmpty>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title="Compras por recibir" action={action}>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {data.purchases.map((purchase) => (
          <div
            key={purchase.id}
            className="flex items-center justify-between rounded-lg p-3"
            style={{
              backgroundColor: 'var(--color-background)',
              borderLeft: `4px solid var(--color-info)`,
            }}
          >
            <div className="flex-1">
              <p style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                {purchase.supplierName}
              </p>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                {purchase.itemCount} artículos • {formatCurrency(purchase.total)}
              </p>
            </div>
            <span
              style={{
                padding: '4px 12px',
                borderRadius: '4px',
                backgroundColor: 'color-mix(in srgb, var(--color-info) 10%, transparent)',
                color: 'var(--color-info)',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              BORRADOR
            </span>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}
