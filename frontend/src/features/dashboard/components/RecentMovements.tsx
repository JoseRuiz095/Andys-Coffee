import type { ReactNode } from 'react';
import { useDashboardRecentMovements } from '../hooks/useDashboard';
import { Skeleton } from '../../../shared/components/Skeleton';
import { QueryErrorState } from '../../../shared/components/QueryErrorState';
import { DashboardCard, DashboardCardEmpty } from './DashboardCard';

interface RecentMovementsProps {
  limit?: number;
  /** Link to the module with the full list. */
  action?: ReactNode;
}

export function RecentMovements({ limit = 20, action }: RecentMovementsProps) {
  const { data, isLoading, error, refetch, isFetching } = useDashboardRecentMovements({ limit });

  if (error) {
    return (
      <DashboardCard title="Movimientos recientes" action={action}>
        <QueryErrorState error={error} subject="los movimientos recientes" onRetry={() => void refetch()} isRetrying={isFetching} />
      </DashboardCard>
    );
  }

  if (isLoading) {
    return (
      <DashboardCard title="Movimientos recientes" action={action}>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      </DashboardCard>
    );
  }

  if (!data?.movements.length) {
    return (
      <DashboardCard title="Movimientos recientes" action={action}>
        <DashboardCardEmpty>No hay movimientos registrados</DashboardCardEmpty>
      </DashboardCard>
    );
  }

  const getMovementColor = (type: string) => {
    switch (type) {
      case 'purchase':
        return 'var(--color-success)';
      case 'sale':
        return 'var(--color-primary)';
      case 'sale_reversal':
        return 'var(--color-warning)';
      case 'adjustment':
        return 'var(--color-info)';
      case 'exit':
        return 'var(--color-danger)';
      default:
        return 'var(--color-text-secondary)';
    }
  };

  const getMovementLabel = (type: string) => {
    switch (type) {
      case 'purchase':
        return 'Compra';
      case 'sale':
        return 'Venta';
      case 'sale_reversal':
        return 'Venta cancelada';
      case 'adjustment':
        return 'Ajuste';
      case 'exit':
        return 'Salida';
      default:
        return type;
    }
  };

  return (
    <DashboardCard title="Movimientos recientes" action={action}>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {data.movements.map((movement) => (
          <div
            key={movement.id}
            className="flex items-center justify-between rounded-lg p-3"
            style={{
              backgroundColor: 'var(--color-background)',
            }}
          >
            <div className="flex-1">
              <p style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                {movement.ingredientName}
              </p>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                {movement.quantity.toFixed(2)} u • {new Date(movement.createdAt).toLocaleDateString('es-MX')}
              </p>
            </div>
            <span
              style={{
                padding: '4px 12px',
                borderRadius: '4px',
                backgroundColor: `color-mix(in srgb, ${getMovementColor(movement.type)} 10%, transparent)`,
                color: getMovementColor(movement.type),
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              {getMovementLabel(movement.type)}
            </span>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}
