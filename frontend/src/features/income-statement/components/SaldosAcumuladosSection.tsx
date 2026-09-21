import React from 'react';
import type { DayFinancialSummary } from '../api/income-statement.api';
import { StatBlock } from './StatBlock';
import { EditAccumulatedBalancesModal } from './EditAccumulatedBalancesModal';
import { getTodayDateString } from '../../../shared/utils/dateUtils';

export function SaldosAcumuladosSection({ summary }: { summary: DayFinancialSummary }) {
  const { saldosAcumulados, date } = summary;
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const isToday = date === getTodayDateString();

  return (
    <>
      <section
        className="rounded-2xl border p-5 shadow-sm"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Saldos Acumulados
          </h3>
          {isToday && (
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="rounded px-3 py-1 text-sm font-semibold transition hover:opacity-80"
              style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
            >
              Editar
            </button>
          )}
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
          <StatBlock label="Ahorro Acumulado" value={saldosAcumulados.ahorroAcumulado} emphasize />
          <StatBlock
            label="Fondo del Negocio Acumulado"
            value={saldosAcumulados.fondoNegocioAcumulado}
            emphasize
          />
          <StatBlock label="Surtido Acumulado" value={saldosAcumulados.surtidoAcumulado} emphasize />
        </div>
      </section>

      <EditAccumulatedBalancesModal
        isOpen={isEditModalOpen}
        date={date}
        currentValues={saldosAcumulados}
        ganciaNeta={summary.movimientos.gananciaNeta}
        onClose={() => setIsEditModalOpen(false)}
      />
    </>
  );
}
