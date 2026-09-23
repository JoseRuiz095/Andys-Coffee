interface ApiErrorLike {
  response?: {
    status?: number
    data?: {
      message?: string
    }
  }
}

/**
 * Extracts a user-facing message from an Axios-style error without resorting
 * to `any`. Falls back to a caller-provided message when the response shape
 * doesn't match (network errors, unexpected payloads, etc.).
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  const apiError = error as ApiErrorLike
  return apiError?.response?.data?.message ?? fallback
}

/** HTTP status of an Axios-style error, if the server answered. */
export function getErrorStatus(error: unknown): number | undefined {
  return (error as ApiErrorLike)?.response?.status
}
