import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useDashboardCostEvolution, type PeriodType } from '../hooks/useDashboard';
import { Skeleton } from '../../../shared/components/Skeleton';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import { formatAxisCurrency, formatChartDay } from '../utils/chartFormat';

interface CostEvolutionChartProps {
  period: PeriodType;
}

export function CostEvolutionChart({ period }: CostEvolutionChartProps) {
  const { data, isLoading, error } = useDashboardCostEvolution({ period });

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
          Evolución de Costos
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
          Evolución de Costos
        </h3>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data?.data.some((item) => item.revenue > 0 || item.cogs > 0)) {
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
          Evolución de Costos
        </h3>
        <p className="mt-2">No hay ventas en este periodo</p>
      </div>
    );
  }

  const chartData = data.data.map((item) => ({
    date: formatChartDay(item.date),
    cogs: item.cogs,
    revenue: item.revenue,
    margin: Number(item.marginPercent.toFixed(1)),
  }));
  // A line needs two points: with few days (e.g. "Hoy") the dots are what is visible.
  const showDots = chartData.length <= 7;

  return (
    <div
      className="min-w-0 rounded-2xl border p-5"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
        Evolución de Costos
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="date" stroke="var(--color-text-secondary)" />
          <YAxis
            yAxisId="money"
            stroke="var(--color-text-secondary)"
            tickFormatter={formatAxisCurrency}
            width={70}
          />
          <YAxis
            yAxisId="margin"
            orientation="right"
            stroke="var(--color-text-secondary)"
            tickFormatter={(value: number) => `${value}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
            formatter={(value, name) => (name === 'Margen (%)' ? `${value}%` : formatCurrency(Number(value)))}
          />
          <Legend />
          <Line
            yAxisId="money"
            type="monotone"
            dataKey="revenue"
            stroke="var(--color-success)"
            name="Ingresos (MXN)"
            dot={showDots}
          />
          <Line
            yAxisId="money"
            type="monotone"
            dataKey="cogs"
            stroke="var(--color-warning)"
            name="Costo de venta (MXN)"
            dot={showDots}
          />
          <Line
            yAxisId="margin"
            type="monotone"
            dataKey="margin"
            stroke="var(--color-info)"
            strokeDasharray="4 4"
            name="Margen (%)"
            dot={showDots}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
