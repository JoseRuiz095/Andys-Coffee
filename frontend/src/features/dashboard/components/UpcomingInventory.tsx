import { useDashboardUpcomingPurchases } from '../hooks/useDashboard';
import { Skeleton } from '../../../shared/components/Skeleton';
import { formatCurrency } from '../../../shared/utils/formatCurrency';

interface UpcomingInventoryProps {
  limit?: number;
}

export function UpcomingInventory({ limit = 10 }: UpcomingInventoryProps) {
  const { data, isLoading, error } = useDashboardUpcomingPurchases({ limit });

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
          Próximas Entradas de Inventario
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
          Próximas Entradas de Inventario
        </h3>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      </div>
    );
  }

  if (!data?.purchases.length) {
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
          Próximas Entradas de Inventario
        </h3>
        <p className="mt-2">No hay compras pendientes</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
        Próximas Entradas de Inventario ({data.count})
      </h3>
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
    </div>
  );
}
