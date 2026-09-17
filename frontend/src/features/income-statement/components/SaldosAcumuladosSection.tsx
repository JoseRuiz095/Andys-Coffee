import type { DayFinancialSummary } from '../api/income-statement.api';
import { StatBlock } from './StatBlock';

export function SaldosAcumuladosSection({ summary }: { summary: DayFinancialSummary }) {
  const { saldosAcumulados } = summary;

  return (
    <section
      className="rounded-2xl border p-5 shadow-sm"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <h3 className="mb-3 text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
        Saldos Acumulados
      </h3>
      <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
        <StatBlock label="Ahorro Acumulado" value={saldosAcumulados.ahorroAcumulado} emphasize />
        <StatBlock label="Fondo del Negocio Acumulado" value={saldosAcumulados.fondoNegocioAcumulado} emphasize />
        <StatBlock label="Surtido Acumulado" value={saldosAcumulados.surtidoAcumulado} emphasize />
      </div>
    </section>
  );
}
