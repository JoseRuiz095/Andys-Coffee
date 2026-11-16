import { describe, expect, it } from 'vitest'
import { buildPurchaseLine, getEditableValues, toPurchaseItemPayload } from './purchaseLine'

describe('buildPurchaseLine', () => {
  it('keeps base-unit lines as typed, the unit cost being total / quantity', () => {
    const line = buildPurchaseLine({ ingredientId: 'i1', baseUnit: 'kg', quantity: 4, totalCost: 200 })
    expect(line.quantity).toBe(4)
    expect(line.unitCost).toBe(50)
    expect(line.capturedTotalCost).toBe(200)
  })

  it('converts kg captured for an ingredient stored in grams', () => {
    const line = buildPurchaseLine({ ingredientId: 'i1', baseUnit: 'gr', captureUnit: 'kg', quantity: 2, totalCost: 300 })
    expect(line.quantity).toBe(2000)
    expect(line.unitCost).toBeCloseTo(0.15)
    // What was typed: 2 kg for $300 in total ($150 per kg), never 2 × $300.
    expect(line.capturedQuantity).toBe(2)
    expect(line.capturedTotalCost).toBe(300)
    expect(line.quantity * line.unitCost).toBeCloseTo(300)
  })

  it('rejects units that cannot be converted', () => {
    expect(() => buildPurchaseLine({ ingredientId: 'i1', baseUnit: 'pz', captureUnit: 'kg', quantity: 1, totalCost: 1 })).toThrow()
  })
})

describe('getEditableValues', () => {
  it('restores the typed total for lines captured on screen', () => {
    const line = buildPurchaseLine({ ingredientId: 'i1', baseUnit: 'gr', captureUnit: 'kg', quantity: 2, totalCost: 300 })
    expect(getEditableValues(line)).toEqual({ quantity: 2, totalCost: 300, captureUnit: 'kg' })
  })

  it('derives the total for lines restored from a draft (base units only)', () => {
    expect(getEditableValues({ ingredientId: 'i1', quantity: 3, unitCost: 20, unitAbbreviation: 'lt' })).toEqual({
      quantity: 3,
      totalCost: 60,
      captureUnit: 'lt',
    })
  })
})

describe('toPurchaseItemPayload', () => {
  it('sends only the fields the API accepts', () => {
    const line = buildPurchaseLine({ ingredientId: 'i1', ingredientName: 'Leche', baseUnit: 'lt', quantity: 1, totalCost: 25 })
    expect(toPurchaseItemPayload(line)).toEqual({ ingredientId: 'i1', quantity: 1, unitCost: 25 })
  })
})
