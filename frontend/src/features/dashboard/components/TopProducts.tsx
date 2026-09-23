import { useDashboardSales, type PeriodType } from '../hooks/useDashboard';
import { Skeleton } from '../../../shared/components/Skeleton';

interface TopProductsProps {
  period: PeriodType;
}

export function TopProducts({ period }: TopProductsProps) {
  const { data, isLoading, error } = useDashboardSales({ period, limit: 5 });

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
          Productos Más Vendidos
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
          Productos Más Vendidos
        </h3>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      </div>
    );
  }

  if (!data?.topProducts.length) {
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
          Productos Más Vendidos
        </h3>
        <p className="mt-2">No hay datos disponibles</p>
      </div>
    );
  }

  const maxQuantity = Math.max(...data.topProducts.map((p) => p.quantity), 1);

  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
        Productos Más Vendidos
      </h3>
      <div className="space-y-3">
        {data.topProducts.map((product, idx) => (
          <div key={product.productId} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: 'var(--color-text-primary)' }}>
                {idx + 1}. {product.productName}
              </span>
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {product.quantity} unidades
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--color-border)' }}
            >
              <div
                className="h-full"
                style={{
                  width: `${(product.quantity / maxQuantity) * 100}%`,
                  backgroundColor: 'var(--color-primary)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
