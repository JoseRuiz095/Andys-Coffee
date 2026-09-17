interface ApiErrorLike {
  response?: {
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
