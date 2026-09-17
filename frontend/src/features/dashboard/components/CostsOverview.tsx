import { useDashboardCosts, type PeriodType } from '../hooks/useDashboard';
import { Skeleton } from '../../../shared/components/Skeleton';

interface CostsOverviewProps {
  period: PeriodType;
}

function MetricRow({
  label,
  value,
  percent,
  variant = 'normal',
}: {
  label: string;
  value: string;
  percent?: number;
  variant?: 'normal' | 'success' | 'warning';
}) {
  const percentColor = variant === 'success' ? 'var(--color-success)' : variant === 'warning' ? 'var(--color-warning)' : 'var(--color-primary)';

  return (
    <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
      <span style={{ color: 'var(--color-text-primary)' }}>{label}</span>
      <div className="flex items-center gap-3">
        <span style={{ color: 'var(--color-text-primary)' }} className="font-medium">
          {value}
        </span>
        {percent !== undefined && (
          <span style={{ color: percentColor }} className="text-sm font-semibold w-16 text-right">
            {percent.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

export function CostsOverview({ period }: CostsOverviewProps) {
  const { data, isLoading, error } = useDashboardCosts({ period });

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
          Análisis de Costos
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
          Análisis de Costos
        </h3>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
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
        Análisis de Costos
      </h3>
      <div>
        <MetricRow label="Ingresos" value={formatCurrency(data.revenue)} />
        <MetricRow label="Costo de Venta (COGS)" value={formatCurrency(data.cogs)} />
        <MetricRow
          label="Ganancia Bruta"
          value={formatCurrency(data.grossProfit)}
          percent={data.grossMarginPercent}
          variant={data.grossMarginPercent > 0 ? 'success' : 'warning'}
        />
        <MetricRow label="Gastos Operacionales" value={formatCurrency(data.expenses)} />
        <MetricRow
          label="Ganancia Neta"
          value={formatCurrency(data.netProfit)}
          percent={data.netMarginPercent}
          variant={data.netMarginPercent > 0 ? 'success' : 'warning'}
        />
      </div>
    </div>
  );
}
