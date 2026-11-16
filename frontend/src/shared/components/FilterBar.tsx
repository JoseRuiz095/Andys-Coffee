import type { ReactNode } from 'react'

interface FilterBarProps {
  /** The filter fields (search, selects, dates), laid out in one row that wraps when needed. */
  children: ReactNode
  /** Shows "Limpiar filtros" only when something is filtered. */
  hasFilters: boolean
  onClear: () => void
  className?: string
}

/**
 * Compact filter row: the fields themselves show what is filtered, so there is no title nor a
 * second "filtros activos" list repeating their values.
 */
export function FilterBar({ children, hasFilters, onClear, className = '' }: FilterBarProps) {
  return (
    <div role="search" className={`mb-4 flex flex-wrap items-end gap-3 ${className}`.trim()}>
      {children}
      {hasFilters && (
        <button
          type="button"
          onClick={onClear}
          className="min-h-10 rounded-lg px-3 text-sm font-medium underline-offset-2 transition hover:underline"
          style={{ color: 'var(--color-primary)' }}
        >
          Limpiar filtros
        </button>
      )}
    </div>
  )
}

