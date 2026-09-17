import { useDashboardProductCosts, type PeriodType } from '../hooks/useDashboard';
import { Skeleton } from '../../../shared/components/Skeleton';
import { formatCurrency } from '../../../shared/utils/formatCurrency';

interface ProductCostsBreakdownProps {
  period: PeriodType;
}

export function ProductCostsBreakdown({ period }: ProductCostsBreakdownProps) {
  const { data, isLoading, error } = useDashboardProductCosts({ period, limit: 10 });

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
          Análisis de Costos por Producto
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
          Análisis de Costos por Producto
        </h3>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      </div>
    );
  }

  if (!data?.products.length) {
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
          Análisis de Costos por Producto
        </h3>
        <p className="mt-2">No hay datos disponibles</p>
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
        Análisis de Costos por Producto
      </h3>
      <div className="space-y-3">
        {data.products.map((product) => (
          <div
            key={product.productId}
            className="rounded-lg p-3"
            style={{
              backgroundColor: 'var(--color-background)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                {product.productName}
              </span>
              <span
                style={{
                  color: product.marginPercent > 0 ? 'var(--color-success)' : 'var(--color-danger)',
                  fontWeight: 600,
                }}
              >
                {product.marginPercent.toFixed(1)}%
              </span>
            </div>
            <div className="text-xs space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
              <div className="flex justify-between">
                <span>Ingresos:</span>
                <span>{formatCurrency(product.revenue)}</span>
              </div>
              <div className="flex justify-between">
                <span>Costo:</span>
                <span>{formatCurrency(product.cogs)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cantidad vendida:</span>
                <span>{product.quantity.toFixed(2)} u</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
