import { describe, expect, it } from 'vitest'
import { isSessionExpiry } from './api'

describe('isSessionExpiry', () => {
  it('treats a 401 with an active session as an expired session', () => {
    expect(isSessionExpiry(401, '/orders', true)).toBe(true)
    expect(isSessionExpiry(401, '/auth/me', true)).toBe(true)
  })

  it('ignores wrong credentials on the login form', () => {
    expect(isSessionExpiry(401, '/auth/login', true)).toBe(false)
    expect(isSessionExpiry(401, '/auth/login', false)).toBe(false)
  })

  it('ignores 401s once the session is already gone (no repeated notices)', () => {
    expect(isSessionExpiry(401, '/notifications', false)).toBe(false)
  })

  it('ignores other statuses', () => {
    expect(isSessionExpiry(403, '/orders', true)).toBe(false)
    expect(isSessionExpiry(undefined, '/orders', true)).toBe(false)
  })
})
