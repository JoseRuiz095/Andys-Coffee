import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useDashboardCostEvolution, type PeriodType } from '../hooks/useDashboard';
import { Skeleton } from '../../../shared/components/Skeleton';
import { QueryErrorState } from '../../../shared/components/QueryErrorState';
import { DashboardCard, DashboardCardEmpty } from './DashboardCard';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import { formatAxisCurrency, formatChartDay } from '../utils/chartFormat';

interface CostEvolutionChartProps {
  period: PeriodType;
}

export function CostEvolutionChart({ period }: CostEvolutionChartProps) {
  const { data, isLoading, error, refetch, isFetching } = useDashboardCostEvolution({ period });

  if (error) {
    return (
      <DashboardCard title="Evolución de costos">
        <QueryErrorState error={error} subject="la evolución de costos" onRetry={() => void refetch()} isRetrying={isFetching} />
      </DashboardCard>
    );
  }

  if (isLoading) {
    return (
      <DashboardCard title="Evolución de costos">
        <Skeleton className="h-64" />
      </DashboardCard>
    );
  }

  if (!data?.data.some((item) => item.revenue > 0 || item.cogs > 0)) {
    return (
      <DashboardCard title="Evolución de costos">
        <DashboardCardEmpty>No hay ventas en este periodo</DashboardCardEmpty>
      </DashboardCard>
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
    <DashboardCard title="Evolución de costos">
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
    </DashboardCard>
  );
}
