/** Labels of the payment methods the API uses (orders, payments, expenses, deliveries). */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  pending: 'Pendiente',
}

/** Spanish label of a payment method; unknown values are shown as they come. */
export function formatPaymentMethod(method: string | null | undefined): string {
  if (!method) return '—'
  return PAYMENT_METHOD_LABELS[method] ?? method
}

/** "Efectivo, Transferencia" for a sale paid in more than one way. */
export function formatPaymentMethods(methods: string[]): string {
  return [...new Set(methods)].map(formatPaymentMethod).join(', ')
}
