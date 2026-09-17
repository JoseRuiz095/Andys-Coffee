import type { DayFinancialSummary } from '../api/income-statement.api';
import { StatBlock } from './StatBlock';
import { formatPercent } from '../../../shared/utils/formatCurrency';

export function DistribucionSection({ summary }: { summary: DayFinancialSummary }) {
  const { distribucion, movimientos } = summary;
  const noDistribution = movimientos.gananciaNeta <= 0;

  return (
    <section
      className="rounded-2xl border p-5 shadow-sm"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <h3 className="mb-3 text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
        Distribución
      </h3>
      {noDistribution ? (
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Sin distribución (la ganancia neta del día no fue positiva).
        </p>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
          <StatBlock label={`Ahorro (${formatPercent(distribucion.porcentajes.ahorro)})`} value={distribucion.ahorro} />
          <StatBlock
            label={`Fondo del Negocio (${formatPercent(distribucion.porcentajes.fondoNegocio)})`}
            value={distribucion.fondoNegocio}
          />
          <StatBlock label={`Surtido (${formatPercent(distribucion.porcentajes.surtido)})`} value={distribucion.surtido} />
        </div>
      )}
    </section>
  );
}
