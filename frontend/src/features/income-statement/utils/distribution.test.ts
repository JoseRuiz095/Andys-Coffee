import { describe, expect, it } from 'vitest'
import { parsePercent } from './distribution'

describe('parsePercent', () => {
  it('an empty field is not 0', () => {
    expect(parsePercent('')).toBeNull()
    expect(parsePercent('  ')).toBeNull()
  })
  it('accepts 0–100 and rejects the rest', () => {
    expect(parsePercent('0')).toBe(0)
    expect(parsePercent('12.5')).toBe(12.5)
    expect(parsePercent('100')).toBe(100)
    expect(parsePercent('101')).toBeNull()
    expect(parsePercent('-1')).toBeNull()
    expect(parsePercent('abc')).toBeNull()
  })
})
