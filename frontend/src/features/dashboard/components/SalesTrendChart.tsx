import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useDashboardSalesTrend, type PeriodType } from '../hooks/useDashboard';
import { Skeleton } from '../../../shared/components/Skeleton';

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

  if (!data?.data.length) {
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
        <p className="mt-2">No hay datos disponibles</p>
      </div>
    );
  }

  const chartData = data.data.map((item) => ({
    date: new Date(item.date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
    ordersCount: item.ordersCount,
    revenue: item.revenue,
  }));

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
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis stroke="var(--color-text-secondary)" />
          <YAxis stroke="var(--color-text-secondary)" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="ordersCount"
            stroke="var(--color-primary)"
            name="Órdenes"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="var(--color-success)"
            name="Ingresos (COP)"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
