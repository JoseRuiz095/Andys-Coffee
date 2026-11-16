import type { ReactNode } from 'react';
import { useDashboardSummary, type PeriodType } from '../hooks/useDashboard';
import { Skeleton } from '../../../shared/components/Skeleton';
import { QueryErrorState } from '../../../shared/components/QueryErrorState';
import { formatCurrency } from '../../../shared/utils/formatCurrency';

interface DashboardSummaryProps {
  period: PeriodType;
  /** Opens Inventario › Existencias from the low-stock figure (only when the user may see it). */
  onOpenInventory?: () => void;
}

function StatTile({ label, value, hint, valueColor, onClick }: { label: string; value: ReactNode; hint?: string; valueColor?: string; onClick?: () => void }) {
  const content = (
    <>
      <span className="block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <span className="mt-1 block text-2xl font-bold" style={{ color: valueColor ?? 'var(--color-text-primary)' }}>
        {value}
      </span>
      {hint && (
        <span className="mt-1 block text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {hint}
        </span>
      )}
    </>
  );
  const className = 'rounded-xl border px-4 py-3 text-left';
  const style = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' };
  return onClick ? (
    <button type="button" onClick={onClick} className={`${className} transition hover:bg-[var(--color-surface-hover)]`} style={style}>
      {content}
    </button>
  ) : (
    <div className={className} style={style}>
      {content}
    </div>
  );
}

/** One strip with the period's figures; the cards below explain each of them. */
export function DashboardSummary({ period, onOpenInventory }: DashboardSummaryProps) {
  const { data, isLoading, error, refetch, isFetching } = useDashboardSummary({ period });

  if (error) {
    return <QueryErrorState error={error} subject="el resumen" onRetry={() => void refetch()} isRetrying={isFetching} />;
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const lowStock = data.lowStockProducts + data.outOfStockProducts;
  // The sign is what matters here (the period isn't compared with a previous one).
  const isLoss = data.profit < 0;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      <StatTile label="Órdenes" value={data.ordersCount} />
      <StatTile label="Ingresos" value={formatCurrency(data.revenue)} />
      <StatTile label="Gastos" value={formatCurrency(data.expenses)} hint="Gastos + compras recibidas" />
      <StatTile
        label={isLoss ? 'Pérdida' : 'Utilidad'}
        value={formatCurrency(data.profit)}
        valueColor={isLoss ? 'var(--color-danger)' : 'var(--color-success)'}
        hint={data.fixedExpenses > 0 ? `Distribuible: ${formatCurrency(data.distributableProfit)}` : undefined}
      />
      <StatTile
        label="Stock bajo"
        value={`${lowStock} ${lowStock === 1 ? 'insumo' : 'insumos'}`}
        hint={data.outOfStockProducts > 0 ? `${data.outOfStockProducts} agotados` : undefined}
        onClick={onOpenInventory}
      />
    </div>
  );
}
