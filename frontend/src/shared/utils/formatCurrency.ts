export function formatCurrency(value: number, options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? options?.minimumFractionDigits ?? 0,
  }).format(value);
}

export function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}
