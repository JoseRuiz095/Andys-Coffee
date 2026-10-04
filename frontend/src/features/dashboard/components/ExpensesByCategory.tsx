import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDashboardExpensesByCategory, type PeriodType } from '../hooks/useDashboard';
import { Skeleton } from '../../../shared/components/Skeleton';
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
  const { data, isLoading, error } = useDashboardExpensesByCategory({ period });

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
          Gastos por Categoría
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
          Gastos por Categoría
        </h3>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data?.categories.length) {
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
          Gastos por Categoría
        </h3>
        <p className="mt-2">No hay datos disponibles</p>
      </div>
    );
  }

  const chartData = data.categories.map((cat) => ({
    category: CATEGORY_LABELS[cat.category] ?? cat.category,
    amount: cat.amount,
  }));

  return (
    <div
      className="min-w-0 rounded-2xl border p-5"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
        Gastos por Categoría
      </h3>
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
    </div>
  );
}
