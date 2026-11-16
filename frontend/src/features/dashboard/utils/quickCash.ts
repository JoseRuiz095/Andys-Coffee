/** Mexican banknotes the customer usually pays with. */
const BANKNOTES = [20, 50, 100, 200, 500, 1000]

/**
 * Amounts offered as one-tap "received" buttons: the bills (up to `limit`) that cover the total
 * with change. The exact amount is a separate button. Empty while there is nothing to charge.
 */
export function quickCashAmounts(total: number, limit = 4): number[] {
  if (!Number.isFinite(total) || total <= 0) return []
  return BANKNOTES.filter((bill) => bill > total).slice(0, limit)
}

/** The total as typed in the "Monto recibido" field (no trailing zeros: 90, 92.5). */
export function cashInputValue(amount: number): string {
  return String(Math.round(amount * 100) / 100)
}
