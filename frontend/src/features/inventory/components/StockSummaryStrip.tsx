import { formatCurrency } from '../../../shared/utils/formatCurrency'

export type StockStatusFilter = 'all' | 'normal' | 'low_stock' | 'out_of_stock'

interface StockSummaryStripProps {
  total: number
  normal: number
  low: number
  outOfStock: number
  value: number
  activeStatus: StockStatusFilter
  /** Clicking a status filters the table by it; clicking it again shows everything. */
  onSelectStatus: (status: StockStatusFilter) => void
  isLoading?: boolean
}

const TILE = 'flex min-w-0 flex-col rounded-lg border px-4 py-3 text-left'

/** The whole inventory at a glance (server totals), in one compact row. */
export function StockSummaryStrip({ total, normal, low, outOfStock, value, activeStatus, onSelectStatus, isLoading = false }: StockSummaryStripProps) {
  const statuses: { status: Exclude<StockStatusFilter, 'all'>; label: string; count: number; color: string }[] = [
    { status: 'normal', label: 'Normal', count: normal, color: 'var(--color-success)' },
    { status: 'low_stock', label: 'Bajo', count: low, color: 'var(--color-warning)' },
    { status: 'out_of_stock', label: 'Agotados', count: outOfStock, color: 'var(--color-danger)' },
  ]
  const number = (n: number) => (isLoading ? '—' : n)

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
      <div className={TILE} style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Ingredientes</span>
        <span className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{number(total)}</span>
      </div>
      {statuses.map(({ status, label, count, color }) => {
        const isActive = activeStatus === status
        return (
          <button
            key={status}
            type="button"
            aria-pressed={isActive}
            title={isActive ? 'Mostrar todos' : `Ver solo: ${label}`}
            onClick={() => onSelectStatus(isActive ? 'all' : status)}
            className={`${TILE} transition hover:bg-[var(--color-surface-hover)]`}
            style={{
              borderColor: isActive ? color : 'var(--color-border)',
              backgroundColor: isActive ? `color-mix(in srgb, ${color} 10%, var(--color-surface))` : 'var(--color-surface)',
            }}
          >
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
            <span className="text-2xl font-bold" style={{ color: count > 0 || status === 'normal' ? color : 'var(--color-text-primary)' }}>
              {number(count)}
            </span>
          </button>
        )
      })}
      <div className={`${TILE} col-span-2 md:col-span-1`} style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Valor del inventario</span>
        <span className="truncate text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>{isLoading ? '—' : formatCurrency(value)}</span>
      </div>
    </div>
  )
}
