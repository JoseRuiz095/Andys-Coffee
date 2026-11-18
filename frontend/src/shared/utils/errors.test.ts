import { describe, expect, it } from 'vitest'
import { getErrorMessage, getErrorStatus } from './errors'

describe('getErrorMessage', () => {
  it('returns the server message when present', () => {
    const error = { response: { status: 409, data: { message: 'La caja ya está cerrada' } } }
    expect(getErrorMessage(error, 'fallback')).toBe('La caja ya está cerrada')
  })

  it('falls back for network errors and unknown values', () => {
    expect(getErrorMessage(new Error('Network Error'), 'Sin conexión')).toBe('Sin conexión')
    expect(getErrorMessage(undefined, 'Sin conexión')).toBe('Sin conexión')
  })
})

describe('getErrorStatus', () => {
  it('reads the HTTP status', () => {
    expect(getErrorStatus({ response: { status: 401 } })).toBe(401)
    expect(getErrorStatus(null)).toBeUndefined()
  })
})

describe('getErrorMessage with field errors (D-10)', () => {
  it('uses the first field reason when the message is the generic validation one', () => {
    const error = { response: { status: 400, data: { message: 'Error de validación.', errors: { items: ['La cantidad máxima es 10,000,000.'] } } } }
    expect(getErrorMessage(error, 'fallback')).toBe('La cantidad máxima es 10,000,000.')
  })

  it('keeps a specific message as is', () => {
    const error = { response: { data: { message: 'Cantidad: muy grande', errors: { items: ['otra'] } } } }
    expect(getErrorMessage(error, 'fallback')).toBe('Cantidad: muy grande')
  })
})
