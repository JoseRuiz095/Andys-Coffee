import type { DayFinancialSummary } from '../api/income-statement.api';
import { StatBlock } from './StatBlock';
import { SinOperacionBadge } from './SinOperacionBadge';

export function MovimientosDelDiaSection({ summary }: { summary: DayFinancialSummary }) {
  return (
    <section
      className="rounded-2xl border p-5 shadow-sm"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Movimientos del Día
        </h3>
        {!summary.hadOperation && <SinOperacionBadge />}
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
        <StatBlock label="Ingresos en efectivo" value={summary.movimientos.ingresosEfectivo} />
        <StatBlock label="Ingresos por transferencia" value={summary.movimientos.ingresosTransferencia} />
        {summary.movimientos.ingresosOtros !== 0 && (
          <StatBlock label="Ingresos otros métodos" value={summary.movimientos.ingresosOtros} />
        )}
        <StatBlock label="Ingresos Totales" value={summary.movimientos.ingresosTotales} emphasize />
        <StatBlock label="Gastos Variables" value={-summary.movimientos.gastos} />
        {summary.movimientos.gastosFueraDeHorario !== 0 && (
          <StatBlock label="· incluye fuera de horario" value={-summary.movimientos.gastosFueraDeHorario} />
        )}
        <StatBlock
          label="Ganancia Neta"
          value={summary.movimientos.gananciaNeta}
          emphasize
          tone={summary.movimientos.gananciaNeta >= 0 ? 'success' : 'danger'}
        />
      </div>
    </section>
  );
}
