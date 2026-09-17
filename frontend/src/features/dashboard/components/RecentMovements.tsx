import { useDashboardRecentMovements } from '../hooks/useDashboard';
import { Skeleton } from '../../../shared/components/Skeleton';

interface RecentMovementsProps {
  limit?: number;
}

export function RecentMovements({ limit = 20 }: RecentMovementsProps) {
  const { data, isLoading, error } = useDashboardRecentMovements({ limit });

  if (error) {
    return (
      <div
        className="rounded-2xl border p-5"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Movimientos Recientes
        </h3>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-danger)' }}>
          Error al cargar
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="rounded-2xl border p-5"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Movimientos Recientes
        </h3>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      </div>
    );
  }

  if (!data?.movements.length) {
    return (
      <div
        className="rounded-2xl border p-5 text-center"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text-secondary)',
        }}
      >
        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Movimientos Recientes
        </h3>
        <p className="mt-2">No hay movimientos registrados</p>
      </div>
    );
  }

  const getMovementColor = (type: string) => {
    switch (type) {
      case 'purchase':
        return 'var(--color-success)';
      case 'sale':
        return 'var(--color-primary)';
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
      case 'adjustment':
        return 'Ajuste';
      case 'exit':
        return 'Salida';
      default:
        return type;
    }
  };

  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
        Movimientos Recientes ({data.count})
      </h3>
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
                {movement.quantity.toFixed(2)} u • {new Date(movement.createdAt).toLocaleDateString('es-ES')}
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
    </div>
  );
}
