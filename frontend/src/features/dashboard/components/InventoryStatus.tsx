import { useDashboardInventory } from '../hooks/useDashboard';
import { Skeleton } from '../../../shared/components/Skeleton';

interface InventoryStatusProps {
  onlyLow?: boolean;
}

export function InventoryStatus({ onlyLow = true }: InventoryStatusProps) {
  const { data, isLoading, error } = useDashboardInventory({ onlyLowStock: onlyLow });

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
          Estado de Inventario
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
          Estado de Inventario
        </h3>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      </div>
    );
  }

  if (!data?.items.length) {
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
          Estado de Inventario
        </h3>
        <p className="mt-2">{onlyLow ? 'Todos los productos tienen stock suficiente' : 'No hay datos disponibles'}</p>
      </div>
    );
  }

  const displayItems = onlyLow ? data.items.filter((i: any) => i.isLow || i.isEmpty) : data.items;

  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
        Estado de Inventario
      </h3>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {displayItems.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Todo está en orden
          </p>
        ) : (
          displayItems.map((item: any) => (
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
                <p style={{ color: 'var(--color-text-secondary)' }} className="text-xs">
                  {item.stock.toFixed(2)} / {item.minimum.toFixed(2)} {item.unit}
                </p>
              </div>
              <span
                className="px-2 py-1 rounded text-xs font-semibold"
                style={{
                  backgroundColor: item.isEmpty
                    ? 'var(--color-danger)'
                    : item.isLow
                    ? 'var(--color-warning)'
                    : 'var(--color-success)',
                  color: 'white',
                }}
              >
                {item.isEmpty ? 'Agotado' : item.isLow ? 'Bajo' : 'OK'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
