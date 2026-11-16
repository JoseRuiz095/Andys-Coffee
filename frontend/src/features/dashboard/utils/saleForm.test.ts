import { describe, expect, it } from 'vitest'
import { getDeliveryCashAmount, getRoleLabel, getSaleValidationError, parseScheduleInput, type SaleFormState } from './saleForm'
import { saleFingerprint } from '../hooks/useSaleAttemptKey'
import type { CreateOrderPayload } from '../types/order.types'

const sale: SaleFormState = {
  itemCount: 2,
  paymentMethod: 'cash',
  customerName: '',
  hasDelivery: false,
  deliveryAmount: '',
  deliveryResponsible: undefined,
  deliveryPaymentMethod: undefined,
}

describe('getSaleValidationError', () => {
  it('accepts a regular cash sale', () => {
    expect(getSaleValidationError(sale)).toBeNull()
  })

  it('rejects an empty cart and a missing payment method', () => {
    expect(getSaleValidationError({ ...sale, itemCount: 0 })?.title).toBe('La orden está vacía')
    expect(getSaleValidationError({ ...sale, paymentMethod: undefined })?.title).toBe('Falta el método de pago')
  })

  it('requires the customer for a pending payment', () => {
    expect(getSaleValidationError({ ...sale, paymentMethod: 'pending', customerName: '  ' })?.description).toContain('nombre del cliente')
    expect(getSaleValidationError({ ...sale, paymentMethod: 'pending', customerName: 'Ana' })).toBeNull()
  })

  it('validates the mandadito', () => {
    const delivery = { ...sale, hasDelivery: true }
    expect(getSaleValidationError({ ...delivery, deliveryAmount: '0' })?.description).toContain('costo del mandadito')
    expect(getSaleValidationError({ ...delivery, deliveryAmount: '30' })?.description).toContain('quién recibe')
    expect(getSaleValidationError({ ...delivery, deliveryAmount: '30', deliveryResponsible: 'customer_to_business' })?.description).toContain('método de pago')
    expect(getSaleValidationError({ ...delivery, deliveryAmount: '30', deliveryResponsible: 'customer_to_courier' })).toBeNull()
  })
})

describe('getDeliveryCashAmount', () => {
  it('only counts a mandadito paid to the business in cash', () => {
    const base = { hasDelivery: true, deliveryAmount: '30', deliveryResponsible: 'customer_to_business' as const }
    expect(getDeliveryCashAmount({ ...base, deliveryPaymentMethod: 'cash' })).toBe(30)
    expect(getDeliveryCashAmount({ ...base, deliveryPaymentMethod: 'transfer' })).toBe(0)
    expect(getDeliveryCashAmount({ ...base, hasDelivery: false, deliveryPaymentMethod: 'cash' })).toBe(0)
  })
})

describe('parseScheduleInput', () => {
  const now = new Date('2026-11-13T10:00:00').getTime()
  it('accepts a future date', () => {
    expect('date' in parseScheduleInput('2026-11-13T11:30', now)).toBe(true)
  })
  it('rejects empty, invalid and past dates', () => {
    expect(parseScheduleInput('', now)).toEqual({ error: 'Selecciona una fecha y hora futura para programar la orden.' })
    expect(parseScheduleInput('no-date', now)).toEqual({ error: 'La fecha y hora programada no son válidas.' })
    expect(parseScheduleInput('2026-11-13T09:00', now)).toEqual({ error: 'La programación debe estar en el futuro.' })
  })
})

describe('getRoleLabel', () => {
  it('names the seeded roles', () => {
    expect(getRoleLabel('ADMIN')).toBe('Administrador')
    expect(getRoleLabel('cajero')).toBe('Cajero')
    expect(getRoleLabel('Supervisor')).toBe('Usuario')
    expect(getRoleLabel(undefined)).toBe('Usuario')
  })
})

describe('saleFingerprint', () => {
  it('ignores the cash received, so retyping it reuses the same attempt', () => {
    const payload = { customerName: 'Cliente', paymentMethod: 'cash', items: [{ productId: 'p1', quantity: 2 }] } as unknown as CreateOrderPayload
    expect(saleFingerprint({ ...payload, cashReceived: 100 })).toBe(saleFingerprint({ ...payload, cashReceived: 200 }))
    expect(saleFingerprint(payload)).not.toBe(saleFingerprint({ ...payload, customerName: 'Ana' }))
  })
})
