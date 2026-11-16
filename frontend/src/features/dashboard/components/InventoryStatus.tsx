import type { ReactNode } from 'react';
import { useDashboardInventory } from '../hooks/useDashboard';
import { Skeleton } from '../../../shared/components/Skeleton';
import { QueryErrorState } from '../../../shared/components/QueryErrorState';
import { DashboardCard, DashboardCardEmpty } from './DashboardCard';
import { StatusBadge } from '../../../shared/components/StatusBadge';

interface InventoryStatusProps {
  onlyLow?: boolean;
  /** Link to the module with the full list. */
  action?: ReactNode;
}

export function InventoryStatus({ onlyLow = true, action }: InventoryStatusProps) {
  const { data, isLoading, error, refetch, isFetching } = useDashboardInventory({ onlyLowStock: onlyLow });

  if (error) {
    return (
      <DashboardCard title="Stock bajo" action={action}>
        <QueryErrorState error={error} subject="el estado del inventario" onRetry={() => void refetch()} isRetrying={isFetching} />
      </DashboardCard>
    );
  }

  if (isLoading) {
    return (
      <DashboardCard title="Stock bajo" action={action}>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      </DashboardCard>
    );
  }

  if (!data?.items.length) {
    return (
      <DashboardCard title="Stock bajo" action={action}>
        <DashboardCardEmpty>{onlyLow ? 'Todos los productos tienen stock suficiente' : 'No hay datos disponibles'}</DashboardCardEmpty>
      </DashboardCard>
    );
  }

  const displayItems = onlyLow ? data.items.filter((i) => i.isLow || i.isEmpty) : data.items;

  return (
    <DashboardCard title="Stock bajo" action={action}>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {displayItems.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Todo está en orden
          </p>
        ) : (
          displayItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg p-3"
              style={{
                backgroundColor: item.isEmpty
                  ? 'color-mix(in srgb, var(--color-danger) 8%, transparent)'
                  : item.isLow
                  ? 'color-mix(in srgb, var(--color-warning) 8%, transparent)'
                  : 'var(--color-background)',
              }}
            >
              <div className="flex-1">
                <p style={{ color: 'var(--color-text-primary)' }} className="font-medium">
                  {item.name}
                </p>
                <p style={{ color: 'var(--color-text-secondary)' }} className="text-sm">
                  {item.stock.toFixed(2)} / {item.minimum.toFixed(2)} {item.unit}
                </p>
              </div>
              <StatusBadge tone={item.isEmpty ? 'danger' : item.isLow ? 'warning' : 'success'}>
                {item.isEmpty ? 'Agotado' : item.isLow ? 'Bajo' : 'OK'}
              </StatusBadge>
            </div>
          ))
        )}
      </div>
    </DashboardCard>
  );
}
