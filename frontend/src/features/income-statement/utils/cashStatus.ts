import type { CashStatus } from '../api/income-statement.api';

export const STATUS_LABEL: Record<Exclude<CashStatus, null>, string> = {
  CUADRADA: 'Caja cuadrada',
  SOBRANTE: 'Sobrante',
  FALTANTE: 'Faltante',
  PENDIENTE: 'Pendiente de cierre',
  SIN_CONTEO: 'Sin conteo',
};

/** Human-readable label for a cash status ("—" when there is none). */
export function cashStatusLabel(status: CashStatus): string {
  return status ? STATUS_LABEL[status] : '—';
}
