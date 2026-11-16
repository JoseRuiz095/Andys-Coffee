import { describe, expect, it } from 'vitest'
import { cashInputValue, quickCashAmounts } from './quickCash'

describe('quickCashAmounts', () => {
  it('offers the bills that cover the total with change', () => {
    expect(quickCashAmounts(90)).toEqual([100, 200, 500, 1000])
    expect(quickCashAmounts(45)).toEqual([50, 100, 200, 500])
    expect(quickCashAmounts(100)).toEqual([200, 500, 1000])
  })

  it('offers nothing above the largest bill or without an amount to charge', () => {
    expect(quickCashAmounts(1500)).toEqual([])
    expect(quickCashAmounts(0)).toEqual([])
    expect(quickCashAmounts(Number.NaN)).toEqual([])
  })

  it('writes the exact amount as the input expects it', () => {
    expect(cashInputValue(90)).toBe('90')
    expect(cashInputValue(92.5)).toBe('92.5')
    expect(cashInputValue(0.1 + 0.2)).toBe('0.3')
  })
})
