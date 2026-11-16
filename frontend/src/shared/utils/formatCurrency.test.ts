import { describe, expect, it } from 'vitest'
import { formatCurrency, formatPercent } from './formatCurrency'

describe('formatCurrency', () => {
  it('formats MXN with two decimals and thousands separators', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50')
  })

  it('formats zero and negatives', () => {
    expect(formatCurrency(0)).toBe('$0.00')
    expect(formatCurrency(-10)).toBe('-$10.00')
  })

  it('honours custom fraction digits', () => {
    expect(formatCurrency(12, { minimumFractionDigits: 0 })).toBe('$12')
  })
})

describe('formatPercent', () => {
  it('keeps two decimals', () => {
    expect(formatPercent(12.345)).toBe('12.35%')
  })
})
