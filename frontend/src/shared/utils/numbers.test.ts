import { describe, expect, it } from 'vitest'
import { parseNonNegativeAmount } from './numbers'

describe('parseNonNegativeAmount', () => {
  it('accepts zero and positive amounts', () => {
    expect(parseNonNegativeAmount('0')).toBe(0)
    expect(parseNonNegativeAmount(' 12.5 ')).toBe(12.5)
  })

  it('treats empty, invalid and negative values as missing, never as 0', () => {
    expect(parseNonNegativeAmount('')).toBeNull()
    expect(parseNonNegativeAmount('   ')).toBeNull()
    expect(parseNonNegativeAmount('abc')).toBeNull()
    expect(parseNonNegativeAmount('-1')).toBeNull()
  })
})
