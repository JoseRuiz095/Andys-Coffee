import { useDashboardSummary, type PeriodType } from '../hooks/useDashboard';
import { Skeleton } from '../../../shared/components/Skeleton';
import { formatCurrency } from '../../../shared/utils/formatCurrency';

interface DashboardSummaryProps {
  period: PeriodType;
}

function StatCard({ label, value, unit = '', trend }: { label: string; value: string | number; unit?: string; trend?: 'up' | 'down' }) {
  return (
    <div
      className="rounded-2xl border p-5 shadow-sm"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </p>
      <div className="mt-3 flex items-baseline justify-between">
        <p className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          {value} <span className="text-sm font-normal">{unit}</span>
        </p>
        {trend && (
          <span
            className="text-xs font-semibold px-2 py-1 rounded"
            style={{
              color: trend === 'up' ? 'var(--color-success)' : 'var(--color-danger)',
              backgroundColor: trend === 'up' ? 'color-mix(in srgb, var(--color-success) 10%, transparent)' : 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
            }}
          >
            {trend === 'up' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </div>
  );
}

export function DashboardSummary({ period }: DashboardSummaryProps) {
  const { data, isLoading, error } = useDashboardSummary({ period });

  if (error) {
    return (
      <div
        className="rounded-2xl border p-5 text-center"
        style={{
          borderColor: 'var(--color-danger)',
          backgroundColor: 'color-mix(in srgb, var(--color-danger) 5%, var(--color-surface))',
          color: 'var(--color-danger)',
        }}
      >
        <p>Error al cargar el resumen</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <StatCard label="Órdenes" value={data.ordersCount} />
      <StatCard label="Ingresos" value={formatCurrency(data.revenue)} />
      <StatCard label="Gastos" value={formatCurrency(data.expenses)} />
      <StatCard
        label="Utilidad"
        value={formatCurrency(data.profit)}
        trend={data.profit >= 0 ? 'up' : 'down'}
      />
      <StatCard
        label="Stock Bajo"
        value={data.lowStockProducts + data.outOfStockProducts}
        unit="ítems"
      />
    </div>
  );
}
