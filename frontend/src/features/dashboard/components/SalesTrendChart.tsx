import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useDashboardSalesTrend, type PeriodType } from '../hooks/useDashboard';
import { Skeleton } from '../../../shared/components/Skeleton';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import { formatAxisCurrency, formatChartDay } from '../utils/chartFormat';

interface SalesTrendChartProps {
  period: PeriodType;
}

export function SalesTrendChart({ period }: SalesTrendChartProps) {
  const { data, isLoading, error } = useDashboardSalesTrend({ period });

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
          Tendencia de Ventas
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
          Tendencia de Ventas
        </h3>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data?.data.some((item) => item.ordersCount > 0)) {
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
          Tendencia de Ventas
        </h3>
        <p className="mt-2">No hay ventas en este periodo</p>
      </div>
    );
  }

  const chartData = data.data.map((item) => ({
    date: formatChartDay(item.date),
    ordersCount: item.ordersCount,
    revenue: item.revenue,
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
        Tendencia de Ventas
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="date" stroke="var(--color-text-secondary)" />
          {/* Money and order counts differ by orders of magnitude: one axis each. */}
          <YAxis
            yAxisId="revenue"
            stroke="var(--color-text-secondary)"
            tickFormatter={formatAxisCurrency}
            width={70}
          />
          <YAxis
            yAxisId="orders"
            orientation="right"
            stroke="var(--color-text-secondary)"
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
            formatter={(value, name) => (name === 'Órdenes' ? value : formatCurrency(Number(value)))}
          />
          <Legend />
          <Line
            yAxisId="revenue"
            type="monotone"
            dataKey="revenue"
            stroke="var(--color-success)"
            name="Ingresos (MXN)"
            dot={showDots}
          />
          <Line
            yAxisId="orders"
            type="monotone"
            dataKey="ordersCount"
            stroke="var(--color-primary)"
            name="Órdenes"
            dot={showDots}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
