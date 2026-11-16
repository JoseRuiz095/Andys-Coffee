import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDashboardExpensesByCategory, type PeriodType } from '../hooks/useDashboard';
import { Skeleton } from '../../../shared/components/Skeleton';
import { QueryErrorState } from '../../../shared/components/QueryErrorState';
import { DashboardCard, DashboardCardEmpty } from './DashboardCard';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import { formatAxisCurrency } from '../utils/chartFormat';

// Expense categories of the backend, plus 'compras' (received purchases).
const CATEGORY_LABELS: Record<string, string> = {
  insumos: 'Insumos',
  servicios: 'Servicios',
  mantenimiento: 'Mantenimiento',
  nomina: 'Nómina',
  renta: 'Renta',
  mandadito: 'Mandaditos',
  otros: 'Otros',
  compras: 'Compras recibidas',
};

interface ExpensesByCategoryProps {
  period: PeriodType;
}

export function ExpensesByCategory({ period }: ExpensesByCategoryProps) {
  const { data, isLoading, error, refetch, isFetching } = useDashboardExpensesByCategory({ period });

  if (error) {
    return (
      <DashboardCard title="Gastos por categoría">
        <QueryErrorState error={error} subject="los gastos por categoría" onRetry={() => void refetch()} isRetrying={isFetching} />
      </DashboardCard>
    );
  }

  if (isLoading) {
    return (
      <DashboardCard title="Gastos por categoría">
        <Skeleton className="h-64" />
      </DashboardCard>
    );
  }

  if (!data?.categories.length) {
    return (
      <DashboardCard title="Gastos por categoría">
        <DashboardCardEmpty>No hay datos disponibles</DashboardCardEmpty>
      </DashboardCard>
    );
  }

  const chartData = data.categories.map((cat) => ({
    category: CATEGORY_LABELS[cat.category] ?? cat.category,
    amount: cat.amount,
  }));

  return (
    <DashboardCard title="Gastos por categoría">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="category" stroke="var(--color-text-secondary)" />
          <YAxis stroke="var(--color-text-secondary)" tickFormatter={formatAxisCurrency} width={70} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
            formatter={(value) => formatCurrency(Number(value))}
          />
          <Bar dataKey="amount" fill="var(--color-warning)" name="Monto (MXN)" />
        </BarChart>
      </ResponsiveContainer>
    </DashboardCard>
  );
}
