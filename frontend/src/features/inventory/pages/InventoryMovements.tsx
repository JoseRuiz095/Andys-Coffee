import { Fragment, useState, useCallback } from 'react'
import { TableSkeleton } from '../../../shared/components/TableSkeleton'
import { QueryErrorState } from '../../../shared/components/QueryErrorState'
import { FilterBar } from '../../../shared/components/FilterBar'
import { FILTER_FIELD_CLASS } from '../../../shared/constants/fieldStyles'
import { PageHeader } from '../../../shared/components/PageHeader'
import { useInventoryMovements } from '../hooks/useInventory'
import type { UseInventoryMovementsParams } from '../hooks/useInventory'
import type { InventoryMovement } from '../api/inventory.api'
import { EXIT_REASON_LABELS, type ExitReason } from '../api/inventory-exits.api'
import { Pagination } from '../../../shared/components/Pagination'
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue'
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import { getMovementTypeColor, getMovementTypeLabel, MOVEMENT_TYPES } from '../constants/movementTypes'

const REFERENCE_LABELS: Record<string, string> = {
  purchase: 'Compra',
  manual_exit: 'Salida manual',
  inventory_count: 'Conteo físico',
  order: 'Venta',
  order_cancellation: 'Cancelación',
  initial_balance: 'Saldo inicial',
}

/** Where the movement comes from, in words: sale #, product and size, or the exit reason. */
function describeOrigin(movement: InventoryMovement): { title: string; detail: string | null } {
  const reason = movement.reason ? EXIT_REASON_LABELS[movement.reason as ExitReason] ?? movement.reason : null
  if (movement.orderItem) {
    const size = movement.orderItem.size === 'JUMBO' ? ' (Jumbo)' : ''
    const prefix = movement.referenceType === 'order_cancellation' ? 'Cancelación de venta' : 'Venta'
    return {
      title: `${prefix} #${movement.orderItem.order.orderNumber}`,
      detail: `${movement.orderItem.productName}${size}${reason ? ` · ${reason}` : ''}`,
    }
  }
  const title = movement.referenceType ? REFERENCE_LABELS[movement.referenceType] ?? movement.referenceType : '—'
  return { title, detail: reason ?? movement.notes }
}




export function InventoryMovements() {
  const [page, setPage] = useState(1)
  const [filterType, setFilterType] = useState<string>('')
  const [searchIngredient, setSearchIngredient] = useState('')
  // One request once the user stops typing, not one per keystroke.
  const debouncedSearch = useDebouncedValue(searchIngredient, 300)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  // Row whose secondary data (unit cost, user) is shown.
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const queryParams: UseInventoryMovementsParams = {
    page,
    limit: 50,
    type: filterType || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    search: debouncedSearch || undefined,
  };

  const { data, isLoading, error, refetch, isFetching } = useInventoryMovements(queryParams);

  const handleSearch = useCallback((value: string) => {
    setSearchIngredient(value);
    setPage(1);
  }, []);

  const handleTypeChange = (newType: string) => {
    setFilterType(newType);
    setPage(1);
  };

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') {
      setStartDate(value);
    } else {
      setEndDate(value);
    }
    setPage(1);
  };

  const movements = data?.data || [];

  const hasFilters = Boolean(searchIngredient || filterType || startDate || endDate);
  const clearFilters = () => {
    handleSearch('');
    handleTypeChange('');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Movimientos" description="Historial de cada entrada, salida, venta y ajuste del inventario." />

      <FilterBar hasFilters={hasFilters} onClear={clearFilters}>
        <input
          type="search"
          value={searchIngredient}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar por nombre o SKU..."
          aria-label="Buscar ingrediente"
          className={`${FILTER_FIELD_CLASS} w-full sm:w-64`}
        />
        <select value={filterType} onChange={(e) => handleTypeChange(e.target.value)} aria-label="Tipo de movimiento" className={FILTER_FIELD_CLASS}>
          <option value="">Todos los tipos</option>
          {MOVEMENT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Desde
          <input type="date" value={startDate} onChange={(e) => handleDateChange('start', e.target.value)} className={FILTER_FIELD_CLASS} />
        </label>
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Hasta
          <input type="date" value={endDate} onChange={(e) => handleDateChange('end', e.target.value)} className={FILTER_FIELD_CLASS} />
        </label>
      </FilterBar>

      {error ? (
        <QueryErrorState error={error} subject="los movimientos" onRetry={() => void refetch()} isRetrying={isFetching} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          {isLoading ? (
            <TableSkeleton rows={6} columns={6} />
          ) : movements.length === 0 ? (
            <p className="p-8 text-center text-[var(--color-text-secondary)]">
              {hasFilters ? 'Ningún movimiento coincide con los filtros.' : 'Aún no hay movimientos de inventario.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                    <th className="px-4 py-3 text-left font-semibold">Ingrediente</th>
                    <th className="px-4 py-3 text-center font-semibold">Tipo</th>
                    <th className="px-4 py-3 text-right font-semibold">Cantidad</th>
                    <th className="px-4 py-3 text-right font-semibold">Saldo</th>
                    <th className="px-4 py-3 text-left font-semibold">Origen</th>
                    <th className="px-2 py-3"><span className="sr-only">Detalle</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {movements.map((movement) => {
                    const origin = describeOrigin(movement);
                    const isExpanded = expandedId === movement.id;
                    return (
                      <Fragment key={movement.id}>
                        <tr className="transition-colors hover:bg-[var(--color-surface-hover)]">
                          <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                            {new Date(movement.createdAt).toLocaleDateString('es-MX', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-[var(--color-text-primary)]">{movement.ingredient.name}</p>
                            {movement.ingredient.sku && <p className="text-xs text-[var(--color-text-secondary)]">{movement.ingredient.sku}</p>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getMovementTypeColor(movement.type)}`}>
                              {getMovementTypeLabel(movement.type)}
                            </span>
                          </td>
                          <td className={`px-4 py-3 text-right ${Number(movement.quantity) < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>
                            {Number(movement.quantity) > 0 ? '+' : ''}
                            {Number(movement.quantity).toFixed(2)}{' '}
                            <span className="text-[var(--color-text-secondary)]">{movement.ingredient.unit.abbreviation}</span>
                          </td>
                          <td
                            className="px-4 py-3 text-right"
                            style={{ color: movement.balanceAfter !== null && Number(movement.balanceAfter) < 0 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}
                          >
                            {movement.balanceAfter === null ? '—' : Number(movement.balanceAfter).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                            <p className="font-medium">{origin.title}</p>
                            {origin.detail && <p>{origin.detail}</p>}
                          </td>
                          <td className="px-2 py-3 text-right">
                            <button
                              type="button"
                              aria-expanded={isExpanded}
                              aria-label={`${isExpanded ? 'Ocultar' : 'Ver'} detalle del movimiento de ${movement.ingredient.name}`}
                              onClick={() => setExpandedId(isExpanded ? null : movement.id)}
                              className="rounded px-2 py-1 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)]"
                            >
                              {isExpanded ? 'Ocultar' : 'Detalle'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-[var(--color-surface-hover)]">
                            <td colSpan={7} className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                              <span className="mr-6">
                                Costo unitario: <strong className="text-[var(--color-text-primary)]">{formatCurrency(Number(movement.unitCost))}</strong>
                              </span>
                              <span>
                                Registrado por: <strong className="text-[var(--color-text-primary)]">{movement.createdBy?.name ?? 'Sistema'}</strong>
                              </span>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {data && data.pagination.totalPages > 1 && (
        <Pagination
          className="mt-4"
          page={page}
          totalPages={data.pagination.totalPages}
          total={data.pagination.total}
          pageSize={data.pagination.limit}
          itemLabel="movimientos"
          onPageChange={setPage}
        />
      )}
    </div>
  )
}
