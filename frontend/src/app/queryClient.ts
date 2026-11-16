import { QueryClient } from '@tanstack/react-query'
import { getErrorStatus } from '../shared/utils/errors'

const MAX_QUERY_RETRIES = 2

/**
 * Retry only what can succeed on a second try: network errors, timeouts and 5xx. A 4xx (expired
 * session, missing permission, not found, business rule) answers the same every time.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const status = getErrorStatus(error)
  if (status !== undefined && status >= 400 && status < 500) return false
  return failureCount < MAX_QUERY_RETRIES
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
    },
    mutations: {
      // Mutations are never retried automatically: sales and payments carry idempotency keys,
      // but the user decides when to try again.
      retry: 0,
    },
  },
})
