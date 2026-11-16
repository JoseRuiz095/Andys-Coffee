import { describe, expect, it } from 'vitest'
import { shouldRetryQuery } from './queryClient'

const httpError = (status: number) => ({ response: { status } })

describe('shouldRetryQuery', () => {
  it('never retries client errors (expired session, forbidden, not found, conflict)', () => {
    for (const status of [400, 401, 403, 404, 409]) {
      expect(shouldRetryQuery(0, httpError(status))).toBe(false)
    }
  })

  it('retries server and network errors up to twice', () => {
    expect(shouldRetryQuery(0, httpError(503))).toBe(true)
    expect(shouldRetryQuery(1, new Error('Network Error'))).toBe(true)
    expect(shouldRetryQuery(2, httpError(500))).toBe(false)
  })
})
