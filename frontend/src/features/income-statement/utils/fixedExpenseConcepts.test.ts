import { describe, expect, it } from 'vitest'
import { getNewConceptError, slugifyConceptLabel } from './fixedExpenseConcepts'

const concepts = [
  { slug: 'luz', label: 'Luz', amount: 60 },
  { slug: 'sueldos', label: 'Sueldos', amount: 200 },
]

describe('slugifyConceptLabel', () => {
  it('keeps letters without their accents', () => {
    expect(slugifyConceptLabel('Ñoño')).toBe('nono')
    expect(slugifyConceptLabel('  Gas  Natural ')).toBe('gas_natural')
  })
})

describe('getNewConceptError', () => {
  it('rejects a label that would overwrite an existing concept', () => {
    expect(getNewConceptError('luz', concepts)).toContain('Ya existe el concepto "Luz"')
    expect(getNewConceptError(' Sueldos ', concepts)).toContain('Sueldos')
  })

  it('rejects labels without letters or numbers', () => {
    expect(getNewConceptError('¡¿?!', concepts)).toBe('El nombre debe tener al menos una letra o número.')
  })

  it('accepts a new concept', () => {
    expect(getNewConceptError('Agua', concepts)).toBeNull()
  })
})
