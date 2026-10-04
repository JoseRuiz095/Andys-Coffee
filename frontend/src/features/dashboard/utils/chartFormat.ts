const compactCurrency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Short axis label for money (e.g. "$1.5 k"); tooltips use the full `formatCurrency`. */
export function formatAxisCurrency(value: number) {
  return compactCurrency.format(value);
}

/**
 * Label for a business day sent by the API as 'YYYY-MM-DD'. Built from its parts:
 * `new Date('YYYY-MM-DD')` is UTC midnight, which is the previous day in Mexico.
 */
export function formatChartDay(day: string) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}
