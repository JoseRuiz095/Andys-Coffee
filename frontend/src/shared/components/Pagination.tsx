import { getPageWindow, getRowRange } from '../utils/pagination'

interface PaginationProps {
  page: number
  totalPages: number
  /** Total rows across all pages. */
  total: number
  /** Rows per page (to show "Mostrando a–b de N"). */
  pageSize: number
  onPageChange: (page: number) => void
  /** Plural noun for the rows, e.g. "movimientos". */
  itemLabel?: string
  disabled?: boolean
  className?: string
}

const navButtonClass =
  'rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50'

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  itemLabel = 'registros',
  disabled = false,
  className = '',
}: PaginationProps) {
  const { from, to } = getRowRange(page, pageSize, total)

  return (
    <nav aria-label="Paginación" className={`flex flex-wrap items-center justify-between gap-3 ${className}`.trim()}>
      <p className="text-sm text-[var(--color-text-secondary)]">
        {total === 0 ? `Sin ${itemLabel}` : `Mostrando ${from}–${to} de ${total} ${itemLabel}`}
      </p>
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => onPageChange(page - 1)} disabled={disabled || page <= 1} className={navButtonClass}>
            Anterior
          </button>
          {getPageWindow(page, totalPages).map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              onClick={() => onPageChange(pageNumber)}
              disabled={disabled}
              aria-current={pageNumber === page ? 'page' : undefined}
              aria-label={`Página ${pageNumber}`}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                pageNumber === page
                  ? 'bg-[var(--color-primary)] text-[var(--color-button-text)]'
                  : 'border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'
              }`}
            >
              {pageNumber}
            </button>
          ))}
          <button type="button" onClick={() => onPageChange(page + 1)} disabled={disabled || page >= totalPages} className={navButtonClass}>
            Siguiente
          </button>
        </div>
      )}
    </nav>
  )
}
