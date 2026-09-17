import type { DayFinancialSummary } from '../api/income-statement.api';
import { StatBlock } from './StatBlock';
import { CashStatusBadge } from './CashStatusBadge';

export function ConciliacionCajaSection({ summary }: { summary: DayFinancialSummary }) {
  const { conciliacion } = summary;

  return (
    <section
      className="rounded-2xl border p-5 shadow-sm"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Conciliación de Caja
        </h3>
        <CashStatusBadge status={conciliacion.estado} />
      </div>
      {conciliacion.sessionsCount === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          No hubo sesiones de caja este día.
        </p>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
          <StatBlock label="Fondo Inicial" value={conciliacion.fondoInicial} />
          <StatBlock label="Efectivo Esperado" value={conciliacion.efectivoEsperado} emphasize />
          <StatBlock label="Efectivo Real" value={conciliacion.efectivoReal} emphasize />
          <StatBlock
            label="Diferencia"
            value={conciliacion.diferencia}
            emphasize
            tone={
              conciliacion.diferencia === null
                ? 'default'
                : conciliacion.diferencia === 0
                  ? 'default'
                  : conciliacion.diferencia > 0
                    ? 'success'
                    : 'danger'
            }
          />
          {conciliacion.openSessionsCount > 0 && (
            <p className="pt-2 text-xs" style={{ color: 'var(--color-warning)' }}>
              {conciliacion.openSessionsCount === conciliacion.sessionsCount
                ? 'Todas las sesiones de este día siguen abiertas.'
                : `${conciliacion.openSessionsCount} de ${conciliacion.sessionsCount} sesiones siguen abiertas.`}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
