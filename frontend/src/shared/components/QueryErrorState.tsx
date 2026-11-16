import { getErrorMessage } from '../utils/errors'

interface QueryErrorStateProps {
  error: unknown
  /** What could not be loaded, with its article ("los pagos pendientes", "el resumen"): it sets the verb's number. */
  subject: string
  onRetry?: () => void
  isRetrying?: boolean
  className?: string
}

/**
 * A list that failed to load. Must be shown instead of the empty state: "no hay pagos
 * pendientes" on an error would make unpaid money look settled.
 */
export function QueryErrorState({ error, subject, onRetry, isRetrying = false, className = '' }: QueryErrorStateProps) {
  return (
    <div role="alert" className={`flex flex-col items-center gap-3 px-4 py-8 text-center ${className}`.trim()}>
      <p className="text-sm font-semibold" style={{ color: 'var(--color-danger)' }}>
        {/^(el|la) /i.test(subject) ? 'No se pudo cargar' : 'No se pudieron cargar'} {subject}.
      </p>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {getErrorMessage(error, 'Revisa tu conexión e inténtalo de nuevo.')}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        >
          {isRetrying ? 'Reintentando…' : 'Reintentar'}
        </button>
      )}
    </div>
  )
}
