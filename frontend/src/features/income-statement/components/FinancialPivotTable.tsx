import type { DayFinancialSummary, PeriodTotals } from '../api/income-statement.api';
import { formatCurrency } from '../../../shared/utils/formatCurrency';

type RowKind = 'flow' | 'accumulated' | 'info';

interface PivotRow {
  label: string;
  kind: RowKind;
  getValue: (day: DayFinancialSummary) => number | string | null;
  getTotal?: (totals: PeriodTotals) => number | null;
}

const ROWS: PivotRow[] = [
  { label: 'Ingresos Efectivo', kind: 'flow', getValue: (d) => d.movimientos.ingresosEfectivo, getTotal: (t) => t.ingresosEfectivo },
  {
    label: 'Ingresos Transferencia',
    kind: 'flow',
    getValue: (d) => d.movimientos.ingresosTransferencia,
    getTotal: (t) => t.ingresosTransferencia,
  },
  { label: 'Ingresos Totales', kind: 'flow', getValue: (d) => d.movimientos.ingresosTotales, getTotal: (t) => t.ingresosTotales },
  { label: 'Costo de Venta', kind: 'flow', getValue: (d) => d.movimientos.costoVenta, getTotal: (t) => t.costoVenta },
  { label: 'Ganancia Bruta', kind: 'flow', getValue: (d) => d.movimientos.gananciaBruta, getTotal: (t) => t.gananciaBruta },
  { label: 'Gastos', kind: 'flow', getValue: (d) => d.movimientos.gastos, getTotal: (t) => t.gastos },
  { label: 'Ganancia Neta', kind: 'flow', getValue: (d) => d.movimientos.gananciaNeta, getTotal: (t) => t.gananciaNeta },
  { label: 'Efectivo Esperado', kind: 'info', getValue: (d) => d.conciliacion.efectivoEsperado },
  { label: 'Efectivo Real', kind: 'info', getValue: (d) => d.conciliacion.efectivoReal },
  { label: 'Diferencia', kind: 'info', getValue: (d) => d.conciliacion.diferencia },
  { label: 'Estado de Caja', kind: 'info', getValue: (d) => d.conciliacion.estado ?? '—' },
  { label: 'Ahorro', kind: 'flow', getValue: (d) => d.distribucion.ahorro, getTotal: (t) => t.ahorro },
  { label: 'Fondo del Negocio', kind: 'flow', getValue: (d) => d.distribucion.fondoNegocio, getTotal: (t) => t.fondoNegocio },
  { label: 'Surtido', kind: 'flow', getValue: (d) => d.distribucion.surtido, getTotal: (t) => t.surtido },
  {
    label: 'Ahorro Acumulado',
    kind: 'accumulated',
    getValue: (d) => d.saldosAcumulados.ahorroAcumulado,
    getTotal: (t) => t.lastAccumulated.ahorroAcumulado,
  },
  {
    label: 'Fondo Negocio Acumulado',
    kind: 'accumulated',
    getValue: (d) => d.saldosAcumulados.fondoNegocioAcumulado,
    getTotal: (t) => t.lastAccumulated.fondoNegocioAcumulado,
  },
  {
    label: 'Surtido Acumulado',
    kind: 'accumulated',
    getValue: (d) => d.saldosAcumulados.surtidoAcumulado,
    getTotal: (t) => t.lastAccumulated.surtidoAcumulado,
  },
];

function formatCell(value: number | string | null) {
  if (value === null) return '—';
  if (typeof value === 'string') return value;
  return formatCurrency(value);
}

interface FinancialPivotTableProps {
  days: DayFinancialSummary[];
  columnLabels: string[];
  totals?: PeriodTotals;
  onSelectDay?: (date: string) => void;
}

export function FinancialPivotTable({ days, columnLabels, totals, onSelectDay }: FinancialPivotTableProps) {
  const showTotal = Boolean(totals);

  return (
    <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--color-border)' }}>
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr>
            <th
              className="sticky left-0 top-0 z-20 min-w-[180px] border-b border-r px-4 py-3 text-left font-semibold"
              style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              Concepto
            </th>
            {days.map((day, i) => (
              <th
                key={day.date}
                className="sticky top-0 z-10 min-w-[110px] border-b px-4 py-3 text-right font-semibold"
                style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              >
                <button
                  type="button"
                  onClick={() => onSelectDay?.(day.date)}
                  className="hover:underline disabled:no-underline"
                  disabled={!onSelectDay}
                >
                  {columnLabels[i]}
                </button>
                {!day.hadOperation && (
                  <div className="mt-1 text-[10px] font-normal" style={{ color: 'var(--color-text-secondary)' }}>
                    Sin operación
                  </div>
                )}
              </th>
            ))}
            {showTotal && (
              <th
                className="sticky top-0 z-10 min-w-[120px] border-b px-4 py-3 text-right font-bold"
                style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              >
                TOTAL
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label}>
              <td
                className="sticky left-0 z-10 border-r px-4 py-2 font-medium"
                style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              >
                {row.label}
              </td>
              {days.map((day) => (
                <td
                  key={day.date}
                  className="px-4 py-2 text-right"
                  style={{
                    color: day.hadOperation ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  }}
                >
                  {day.hadOperation || row.kind === 'accumulated' ? formatCell(row.getValue(day)) : '—'}
                </td>
              ))}
              {showTotal && (
                <td className="px-4 py-2 text-right font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  {row.getTotal && totals ? formatCell(row.getTotal(totals)) : ''}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
