import { describe, expect, it } from 'vitest'
import { validateGeneralPreferences } from './generalPreferences'

const base = { businessName: "Andy's", businessHoursOpen: '07:00', businessHoursClose: '22:00', currency: 'MXN', currencySymbol: '$' }

describe('validateGeneralPreferences', () => {
  it('accepts valid data', () => {
    expect(validateGeneralPreferences({ ...base, phone: '(55) 1234-5678' })).toEqual({})
  })
  it('returns the errors of the current data (not a stale state)', () => {
    const errors = validateGeneralPreferences({ ...base, businessName: ' ', businessHoursClose: '06:00', phone: '---' })
    expect(errors.businessName).toBeTruthy()
    expect(errors.businessHoursClose).toMatch(/después de la apertura/)
    expect(errors.phone).toMatch(/dígito/)
  })
})
