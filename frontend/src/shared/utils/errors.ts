interface ApiErrorLike {
  response?: {
    status?: number
    data?: {
      message?: string
      /** Field errors of a 400 (Zod): { field: ['reason', ...] }. */
      errors?: Record<string, string[] | undefined>
    }
  }
}

const GENERIC_VALIDATION_MESSAGE = 'Error de validación.'

/**
 * Extracts a user-facing message from an Axios-style error without resorting
 * to `any`. Falls back to a caller-provided message when the response shape
 * doesn't match (network errors, unexpected payloads, etc.).
 * A generic validation message is replaced by the first field reason, so the toast says what
 * to fix (QA audit 2026-11-18, D-10).
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  const data = (error as ApiErrorLike)?.response?.data
  const message = data?.message
  if (!message || message === GENERIC_VALIDATION_MESSAGE) {
    const firstFieldError = Object.values(data?.errors ?? {}).flat().find((reason): reason is string => typeof reason === 'string' && reason.length > 0)
    if (firstFieldError) return firstFieldError
  }
  return message ?? fallback
}

/** HTTP status of an Axios-style error, if the server answered. */
export function getErrorStatus(error: unknown): number | undefined {
  return (error as ApiErrorLike)?.response?.status
}
