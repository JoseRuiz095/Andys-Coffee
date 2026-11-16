export type PosPaymentMethod = 'cash' | 'transfer' | 'card' | 'pending'
export type DeliveryResponsible = 'customer_to_courier' | 'customer_to_business' | 'business_absorbs'

export interface SaleFormState {
  itemCount: number
  paymentMethod: PosPaymentMethod | undefined
  customerName: string
  hasDelivery: boolean
  deliveryAmount: string
  deliveryResponsible: DeliveryResponsible | undefined
  deliveryPaymentMethod: 'cash' | 'transfer' | undefined
}

export interface FormProblem {
  title: string
  description: string
}

/** Why the sale can't be processed yet (shown as a toast), or null. */
export function getSaleValidationError(sale: SaleFormState): FormProblem | null {
  if (sale.itemCount === 0) return { title: 'La orden está vacía', description: 'Agrega al menos un producto.' }
  if (!sale.paymentMethod) return { title: 'Falta el método de pago', description: 'Selecciona cómo paga el cliente.' }
  if (sale.paymentMethod === 'pending' && !sale.customerName.trim()) {
    return { title: 'Revisa la orden', description: 'Debes ingresar el nombre del cliente para registrar un pago pendiente.' }
  }
  if (sale.hasDelivery) {
    if (!sale.deliveryAmount || Number(sale.deliveryAmount) <= 0) {
      return { title: 'Revisa la orden', description: 'Ingresa el costo del mandadito.' }
    }
    if (!sale.deliveryResponsible) {
      return { title: 'Revisa la orden', description: 'Indica quién recibe/paga el mandadito.' }
    }
    if (sale.deliveryResponsible === 'customer_to_business' && !sale.deliveryPaymentMethod) {
      return { title: 'Revisa la orden', description: 'Indica el método de pago del mandadito.' }
    }
  }
  return null
}

/** Cash of the mandadito the customer pays to Andy's: it goes into the drawer with the sale. */
export function getDeliveryCashAmount(sale: Pick<SaleFormState, 'hasDelivery' | 'deliveryResponsible' | 'deliveryPaymentMethod' | 'deliveryAmount'>): number {
  return sale.hasDelivery && sale.deliveryResponsible === 'customer_to_business' && sale.deliveryPaymentMethod === 'cash'
    ? Number(sale.deliveryAmount) || 0
    : 0
}

/** `<input type="datetime-local">` value for a date (default: one hour from now). */
export function getLocalDateTimeValue(date: Date = new Date(Date.now() + 60 * 60 * 1000)): string {
  const timezoneOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

/** The scheduled date typed in the dialog, or why it can't be used. */
export function parseScheduleInput(value: string, now: number = Date.now()): { date: Date } | { error: string } {
  if (!value) return { error: 'Selecciona una fecha y hora futura para programar la orden.' }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { error: 'La fecha y hora programada no son válidas.' }
  if (date.getTime() <= now) return { error: 'La programación debe estar en el futuro.' }
  return { date }
}

/** Label of the seeded roles; any other role shows as "Usuario". */
export function getRoleLabel(roleName: string | null | undefined): string {
  const role = (roleName ?? '').toUpperCase()
  if (role === 'ADMIN' || role === 'ADMINISTRADOR') return 'Administrador'
  if (role === 'CAJERO') return 'Cajero'
  return 'Usuario'
}
