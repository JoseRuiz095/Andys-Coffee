import { useDashboardProductCosts, type PeriodType } from '../hooks/useDashboard';
import { Skeleton } from '../../../shared/components/Skeleton';
import { QueryErrorState } from '../../../shared/components/QueryErrorState';
import { DashboardCard, DashboardCardEmpty } from './DashboardCard';
import { formatCurrency } from '../../../shared/utils/formatCurrency';

interface ProductCostsBreakdownProps {
  period: PeriodType;
}

export function ProductCostsBreakdown({ period }: ProductCostsBreakdownProps) {
  const { data, isLoading, error, refetch, isFetching } = useDashboardProductCosts({ period, limit: 10 });

  if (error) {
    return (
      <DashboardCard title="Costos por producto">
        <QueryErrorState error={error} subject="los costos por producto" onRetry={() => void refetch()} isRetrying={isFetching} />
      </DashboardCard>
    );
  }

  if (isLoading) {
    return (
      <DashboardCard title="Costos por producto">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      </DashboardCard>
    );
  }

  if (!data?.products.length) {
    return (
      <DashboardCard title="Costos por producto">
        <DashboardCardEmpty>No hay datos disponibles</DashboardCardEmpty>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title="Costos por producto">
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
    </DashboardCard>
  );
}
