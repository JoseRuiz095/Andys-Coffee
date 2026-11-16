import { useDashboardSales, type PeriodType } from '../hooks/useDashboard';
import { Skeleton } from '../../../shared/components/Skeleton';
import { QueryErrorState } from '../../../shared/components/QueryErrorState';
import { DashboardCard, DashboardCardEmpty } from './DashboardCard';

interface TopProductsProps {
  period: PeriodType;
}

export function TopProducts({ period }: TopProductsProps) {
  const { data, isLoading, error, refetch, isFetching } = useDashboardSales({ period, limit: 5 });

  if (error) {
    return (
      <DashboardCard title="Productos más vendidos">
        <QueryErrorState error={error} subject="los productos más vendidos" onRetry={() => void refetch()} isRetrying={isFetching} />
      </DashboardCard>
    );
  }

  if (isLoading) {
    return (
      <DashboardCard title="Productos más vendidos">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      </DashboardCard>
    );
  }

  if (!data?.topProducts.length) {
    return (
      <DashboardCard title="Productos más vendidos">
        <DashboardCardEmpty>No hay datos disponibles</DashboardCardEmpty>
      </DashboardCard>
    );
  }

  const maxQuantity = Math.max(...data.topProducts.map((p) => p.quantity), 1);

  return (
    <DashboardCard title="Productos más vendidos">
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
    </DashboardCard>
  );
}
