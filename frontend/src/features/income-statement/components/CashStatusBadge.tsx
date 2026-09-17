import type { CashStatus } from '../api/income-statement.api';

const STATUS_LABEL: Record<Exclude<CashStatus, null>, string> = {
  CUADRADA: 'Caja cuadrada',
  SOBRANTE: 'Sobrante',
  FALTANTE: 'Faltante',
  PENDIENTE: 'Pendiente de cierre',
};

const STATUS_COLOR_VAR: Record<Exclude<CashStatus, null>, string> = {
  CUADRADA: '--color-success',
  SOBRANTE: '--color-info',
  FALTANTE: '--color-danger',
  PENDIENTE: '--color-warning',
};

export function CashStatusBadge({ status }: { status: CashStatus }) {
  if (!status) {
    return (
      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        —
      </span>
    );
  }

  const colorVar = STATUS_COLOR_VAR[status];

  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
      style={{
        color: `var(${colorVar})`,
        backgroundColor: `color-mix(in srgb, var(${colorVar}) 12%, transparent)`,
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
