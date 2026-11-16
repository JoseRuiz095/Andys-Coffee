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
