import { beforeEach, describe, expect, it } from 'vitest'
import { useSaleAttemptKey } from './useSaleAttemptKey'
import type { CreateOrderPayload } from '../types/order.types'

const payload = (quantity: number, cashReceived?: number) =>
  ({ customerName: 'Cliente', paymentMethod: 'cash', cashReceived, items: [{ productId: 'latte', quantity }] }) as unknown as CreateOrderPayload

describe('useSaleAttemptKey', () => {
  beforeEach(() => sessionStorage.clear())

  it('reuses the key for the same sale (cash received aside) and starts a new one when the cart changes', () => {
    const attempt = useSaleAttemptKey('sale-test')
    const first = attempt.keyFor(payload(1, 100))
    expect(attempt.keyFor(payload(1, 200))).toBe(first)
    expect(attempt.keyFor(payload(2, 200))).not.toBe(first)
  })

  it('F8: after a lost response the key stays pinned even if the cart changes, until reset', () => {
    const attempt = useSaleAttemptKey('sale-test')
    const first = attempt.keyFor(payload(1))
    attempt.pin()
    // The cashier edits the order and retries: same key, so the server can't create a second sale.
    expect(attempt.keyFor(payload(3))).toBe(first)
    attempt.reset()
    expect(attempt.keyFor(payload(3))).not.toBe(first)
  })
})
