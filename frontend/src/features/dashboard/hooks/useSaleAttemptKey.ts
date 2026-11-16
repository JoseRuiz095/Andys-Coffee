import { sessionEntry } from '../../../shared/hooks/useSessionState'
import type { CreateOrderPayload } from '../types/order.types'

/** What identifies a sale attempt: everything but the cash received. */
export function saleFingerprint(payload: CreateOrderPayload): string {
  return JSON.stringify({ ...payload, cashReceived: undefined })
}

/**
 * Idempotency key of the current sale attempt. It is kept while the cart (and everything else
 * that defines the sale) stays the same, so a retry after a lost response — timeout, network
 * drop — reuses it and the server returns the order it already created. Any change to the sale
 * starts a new attempt. The cash received is left out: retyping it must not create a second sale.
 */
export function useSaleAttemptKey(storageKey: string) {
  // Kept in sessionStorage too: reloading the tab after a lost response must not start a new
  // attempt for the same cart (the persisted cart would otherwise be charged twice).
  const readStored = () => {
    try {
      const raw = sessionEntry.get(storageKey)
      return raw ? (JSON.parse(raw) as { fingerprint: string; key: string; pinned?: boolean }) : null
    } catch {
      return null
    }
  }

  return {
    keyFor(payload: CreateOrderPayload) {
      const fingerprint = saleFingerprint(payload)
      const stored = readStored()
      // After a lost response the key is kept even if the cart changed (F8): if that sale was
      // recorded, the server answers 409 instead of charging a second, different sale.
      if (stored?.pinned || stored?.fingerprint === fingerprint) return stored.key
      const attempt = { fingerprint, key: crypto.randomUUID() }
      sessionEntry.set(storageKey, JSON.stringify(attempt))
      return attempt.key
    },
    /**
     * The request got no answer (timeout, network drop): the sale may or may not exist on the
     * server, so the next submit reuses this key whatever the cart is.
     */
    pin() {
      const stored = readStored()
      if (stored) sessionEntry.set(storageKey, JSON.stringify({ ...stored, pinned: true }))
    },
    /** The sale went through (or the server rejected the reused key): the next one is a new attempt. */
    reset() {
      sessionEntry.set(storageKey, null)
    },
  }
}
