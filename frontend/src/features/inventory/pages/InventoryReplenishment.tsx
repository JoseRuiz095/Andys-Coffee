import { useMemo, useRef, useState } from 'react'
import { sileo } from 'sileo'
import { TableSkeleton } from '../../../shared/components/TableSkeleton'
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import { getErrorMessage } from '../../../shared/utils/errors'
import { hasPermission } from '../../auth/utils/permissions'
import { useProductCoverage, useReplenishment } from '../hooks/useInventory'
import { useCreatePurchase, useSuppliersList } from '../hooks/usePurchases'
import { useCurrentUser } from '../../auth/hooks/useCurrentUser'
import { navigateTo } from '../../../app/navigation'
import { PageHeader } from '../../../shared/components/PageHeader'
import { referenceQuantity, referenceUnitCost, unitCostFromTotal } from '../utils/purchaseLine'
import { FILTER_FIELD_CLASS } from '../../../shared/constants/fieldStyles'
import { ACTION_PRIMARY_CLASS } from '../../../shared/constants/actionStyles'
import { CELL_SECONDARY_CLASS, TABLE_CARD_CLASS, TABLE_CLASS, TABLE_HEAD_CLASS, TD_CLASS, TH_CLASS, TR_CLASS } from '../../../shared/constants/tableStyles'

const PERIODS = [7, 14, 30] as const

const inputStyle = {
  borderColor: 'var(--color-border)',
  backgroundColor: 'var(--color-input-bg)',
  color: 'var(--color-input-text)',
}

/** Inputs and selects inside the suggestion rows (36 px; 44 px on touch screens). */
const ROW_FIELD_CLASS =
  'min-h-9 rounded-lg border px-2 text-sm tabular-nums outline-none transition focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-primary)_25%,transparent)] disabled:opacity-60 pointer-coarse:min-h-11'

const formatQuantity = (value: number) => value.toLocaleString('es-MX', { maximumFractionDigits: 2 })
const roundMoney = (value: number) => Math.round(value * 100) / 100

/**
 * Restock suggestions (plan F7): ingredients at their minimum or running out, with the
 * quantity to reach their target. Selected lines become draft purchases (one per supplier) that
 * are received from "Entradas".
 *
 * The cost is typed as the TOTAL paid for the line (as in "Nueva compra"): quantities are in
 * base units (gr, ml), so a "unit cost" field read as the product's price made a $21 water jug
 * cost $21 per ml. The hint under each field shows the cost per kg/lt to catch typos.
 *
 * Every line needs a supplier (no purchase without one): it starts with the last supplier and
 * can be changed per line; lines are grouped into one draft per supplier. The product filter
 * narrows the list to the ingredients of one recipe.
 */
export function InventoryReplenishment() {
  const canCreate = hasPermission(useCurrentUser(), 'inventory.create_entry')
  const [days, setDays] = useState<(typeof PERIODS)[number]>(14)
  const [productId, setProductId] = useState('')
  // The server filters by product and adds what doesn't cover one unit of it.
  const { data: suggestions = [], isLoading, error } = useReplenishment(days, productId || undefined)
  const createPurchase = useCreatePurchase()
  // Edits keyed by ingredient: selection, quantity and line total as typed.
  type RowEdit = { selected?: boolean; quantity?: string; totalCost?: string; supplierId?: string }
  const [edits, setEdits] = useState<Record<string, RowEdit>>({})
  const { data: coverage = [] } = useProductCoverage()
  const productOptions = useMemo(() => [...coverage].sort((a, b) => a.name.localeCompare(b.name, 'es')), [coverage])
  const selectedProduct = coverage.find((product) => product.id === productId)
  const visibleSuggestions = suggestions
  const { data: supplierPage } = useSuppliersList({ limit: 100, isActive: true })
  const suppliers = useMemo(() => [...(supplierPage?.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'es')), [supplierPage])
  const activeSupplierIds = useMemo(() => new Set(suppliers.map((supplier) => supplier.id)), [suppliers])
  const [isCreating, setIsCreating] = useState(false)
  // Guards a second click before React re-renders with isCreating.
  const creatingRef = useRef(false)
  // The server keeps suggesting an ingredient until its purchase is received, so lines already
  // sent to a draft start unselected: clicking again must not create duplicate drafts.
  const [draftedIds, setDraftedIds] = useState<Set<string>>(() => new Set())

  const rowState = (row: (typeof suggestions)[number]) => {
    const quantity = edits[row.ingredientId]?.quantity ?? String(row.suggestedQuantity)
    // Until a total is typed it follows the quantity at the current average cost.
    const totalCost = edits[row.ingredientId]?.totalCost ?? String(roundMoney((Number(quantity) || 0) * row.unitCost))
    return {
      selected: edits[row.ingredientId]?.selected ?? !draftedIds.has(row.ingredientId),
      quantity,
      totalCost,
      unitCost: unitCostFromTotal(Number(totalCost) || 0, Number(quantity) || 0),
      // The last supplier is preselected only while it is still active.
      supplierId: edits[row.ingredientId]?.supplierId
        ?? (row.lastSupplier && activeSupplierIds.has(row.lastSupplier.id) ? row.lastSupplier.id : ''),
    }
  }
  const edit = (id: string, patch: RowEdit) =>
    setEdits((current) => ({ ...current, [id]: { ...current[id], ...patch } }))

  // Only what is on screen: with a product filter, the drafts are for that product.
  const selected = visibleSuggestions
    .map((row) => ({ row, state: rowState(row) }))
    .filter(({ state }) => state.selected && Number(state.quantity) > 0)
  const total = selected.reduce((sum, { state }) => sum + (Number(state.totalCost) || 0), 0)

  const handleCreateDrafts = async () => {
    if (creatingRef.current) return
    // An empty cost is "not typed", not $0.
    if (selected.some(({ state }) => state.totalCost.trim() === '' || !(Number(state.totalCost) >= 0))) {
      sileo.error({ title: 'Revisa los costos', description: 'El costo total de cada insumo debe ser un número mayor o igual a cero.' })
      return
    }
    const withoutSupplier = selected.filter(({ state }) => !state.supplierId)
    if (withoutSupplier.length > 0) {
      sileo.error({
        title: 'Falta el proveedor',
        description: `No puede haber compra sin proveedor. Elígelo para: ${withoutSupplier.map(({ row }) => row.name).join(', ')}.`,
      })
      return
    }
    // One draft per supplier.
    const groups = new Map<string, typeof selected>()
    for (const line of selected) {
      const key = line.state.supplierId
      groups.set(key, [...(groups.get(key) ?? []), line])
    }
    creatingRef.current = true
    setIsCreating(true)
    let created = 0
    try {
      for (const [supplierId, lines] of groups) {
        await createPurchase.mutateAsync({
          supplierId,
          notes: `Sugerencia de reabastecimiento (consumo de ${days} días)`,
          items: lines.map(({ row, state }) => ({
            ingredientId: row.ingredientId,
            quantity: Number(state.quantity),
            unitCost: state.unitCost,
          })),
        })
        created += 1
        setDraftedIds((current) => new Set([...current, ...lines.map(({ row }) => row.ingredientId)]))
      }
      sileo.success({ title: `${created} borrador(es) de compra creados`, description: 'Recíbelos en Compras → Por recibir.' })
      setEdits({})
    } catch (err) {
      sileo.error({
        title: created > 0 ? `Se crearon ${created} borrador(es), pero no todos` : 'No se pudo crear el borrador',
        description: getErrorMessage(err, 'Intenta de nuevo.'),
      })
    } finally {
      creatingRef.current = false
      setIsCreating(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        title="Sugerencias de compra"
        description="Insumos en su mínimo o con menos de 3 días de existencia, según el consumo real."
        actions={
          <div role="search" className="flex flex-wrap items-center gap-3">
          <select
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            aria-label="Filtrar por producto"
            className={`${FILTER_FIELD_CLASS} max-w-72`}
          >
            <option value="">Todos los productos</option>
            {productOptions.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} — {product.units <= 0 ? 'no alcanza' : `alcanza para ${product.units}`}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Consumo de los últimos
            <select
              value={days}
              onChange={(event) => setDays(Number(event.target.value) as (typeof PERIODS)[number])}
              className={FILTER_FIELD_CLASS}
            >
              {PERIODS.map((period) => <option key={period} value={period}>{period} días</option>)}
            </select>
          </label>
          </div>
        }
      />

      {isLoading ? (
        <TableSkeleton rows={5} columns={8} />
      ) : error ? (
        <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{getErrorMessage(error, 'No se pudieron cargar las sugerencias.')}</p>
      ) : visibleSuggestions.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
          {selectedProduct ? `Ningún insumo de ${selectedProduct.name} necesita reabastecerse.` : 'No hay insumos por reabastecer.'}
        </p>
      ) : (
        <div className={TABLE_CARD_CLASS}>
         <div className="overflow-x-auto">
          <table className={TABLE_CLASS}>
            <thead className={TABLE_HEAD_CLASS}>
              <tr>
                <th className={`${TH_CLASS} w-10`} aria-label="Incluir" />
                <th className={`${TH_CLASS} text-left`}>Insumo</th>
                <th className={`${TH_CLASS} text-right`}>Cobertura</th>
                <th className={`${TH_CLASS} text-left`}>Comprar</th>
                <th className={`${TH_CLASS} text-left`} title="Lo que pagas por toda la cantidad, no el precio por gramo o mililitro">Costo total</th>
                <th className={`${TH_CLASS} text-left`}>Proveedor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {visibleSuggestions.map((row) => {
                const state = rowState(row)
                return (
                  <tr
                    key={row.ingredientId}
                    className={`${TR_CLASS} align-top`}
                    style={{ color: 'var(--color-text-primary)', ...(!state.selected && { opacity: 0.7 }) }}
                  >
                    <td className={`${TD_CLASS} text-center`}>
                      <input
                        type="checkbox"
                        checked={state.selected}
                        onChange={(event) => edit(row.ingredientId, { selected: event.target.checked })}
                        aria-label={`Incluir ${row.name}`}
                        className="mt-2 size-4 accent-[var(--color-primary)]"
                      />
                    </td>
                    <td className={TD_CLASS}>
                      <span className="font-medium">{row.name}</span>
                      <span className={`ml-1 ${CELL_SECONDARY_CLASS}`}>{row.sku}</span>
                      <div className="text-sm tabular-nums" style={{ color: row.currentStock <= 0 ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                        Hay {formatQuantity(row.currentStock)} {row.unit}
                      </div>
                      {row.shortForProduct && selectedProduct && (
                        <span
                          className="mr-2 mt-0.5 inline-block rounded-full px-2 py-0.5 text-[0.8125rem] font-medium"
                          style={{
                            backgroundColor: 'color-mix(in srgb, var(--color-danger) 12%, var(--color-surface))',
                            color: 'var(--color-danger)',
                          }}
                        >
                          No alcanza para un {selectedProduct.name}
                        </span>
                      )}
                      {draftedIds.has(row.ingredientId) && (
                        <span className="ml-2 rounded-full px-2 py-0.5 text-[0.8125rem]" style={{ backgroundColor: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)' }}>
                          borrador creado ·{' '}
                          <button
                            type="button"
                            onClick={() => navigateTo('/dashboard?view=inventario&inv=entries')}
                            className="font-medium underline-offset-2 hover:underline"
                            style={{ color: 'var(--color-primary)' }}
                          >
                            ver en Por recibir
                          </button>
                        </span>
                      )}
                    </td>
                    <td
                      className={`${TD_CLASS} text-right tabular-nums`}
                      title={`Consumo: ${formatQuantity(row.dailyConsumption)} ${row.unit}/día · Mín ${formatQuantity(row.minimumStock)} / Máx ${row.maximumStock === null ? '—' : formatQuantity(row.maximumStock)}`}
                    >
                      <div className="font-medium">{row.coverageDays === null ? '—' : `${row.coverageDays} días`}</div>
                      <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {formatQuantity(row.dailyConsumption)} {row.unit}/día · mín {formatQuantity(row.minimumStock)}
                        {row.maximumStock === null ? '' : ` · máx ${formatQuantity(row.maximumStock)}`}
                      </div>
                    </td>
                    <td className={`${TD_CLASS} whitespace-nowrap`}>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={state.quantity}
                        disabled={!canCreate}
                        onChange={(event) => edit(row.ingredientId, { quantity: event.target.value })}
                        className={`${ROW_FIELD_CLASS} w-24`}
                        style={inputStyle}
                        aria-label={`Cantidad a comprar de ${row.name}`}
                      />
                      <span className={`ml-1 ${CELL_SECONDARY_CLASS}`}>{row.unit}</span>
                      {(() => {
                        const reference = referenceQuantity(Number(state.quantity) || 0, row.unit)
                        return reference && (
                          <div className={`mt-0.5 tabular-nums ${CELL_SECONDARY_CLASS}`}>= {formatQuantity(reference.value)} {reference.unit}</div>
                        )
                      })()}
                    </td>
                    <td className={TD_CLASS}>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={state.totalCost}
                        disabled={!canCreate}
                        onChange={(event) => edit(row.ingredientId, { totalCost: event.target.value })}
                        className={`${ROW_FIELD_CLASS} w-28`}
                        style={inputStyle}
                        aria-label={`Costo total de ${row.name}`}
                      />
                      {state.unitCost > 0 && (() => {
                        const reference = referenceUnitCost(state.unitCost, row.unit)
                        return (
                          <div className={`mt-0.5 tabular-nums ${CELL_SECONDARY_CLASS}`}>
                            {formatCurrency(reference.value)} por {reference.unit}
                          </div>
                        )
                      })()}
                    </td>
                    <td className={TD_CLASS}>
                      <select
                        value={state.supplierId}
                        disabled={!canCreate}
                        onChange={(event) => edit(row.ingredientId, { supplierId: event.target.value })}
                        className={`${ROW_FIELD_CLASS} w-48`}
                        style={{
                          ...inputStyle,
                          // A selected line without supplier can't become a purchase.
                          ...(state.selected && !state.supplierId && { borderColor: 'var(--color-danger)' }),
                        }}
                        aria-label={`Proveedor de ${row.name}`}
                      >
                        <option value="">Elige proveedor</option>
                        {suppliers.map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                        ))}
                      </select>
                      <div className={`mt-0.5 ${CELL_SECONDARY_CLASS}`}>
                        {row.lastSupplier ? `Último: ${row.lastSupplier.name}` : 'Sin compras previas'}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
         </div>
        </div>
      )}

      {visibleSuggestions.length > 0 && canCreate && (
        <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
          <span style={{ color: 'var(--color-text-secondary)' }}>
            {selected.length} insumo(s) · estimado{' '}
            <strong className="text-base tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{formatCurrency(total)}</strong>
          </span>
          <button
            type="button"
            onClick={handleCreateDrafts}
            disabled={selected.length === 0 || isCreating}
            className={ACTION_PRIMARY_CLASS}
          >
            {isCreating ? 'Creando…' : 'Crear borradores de compra'}
          </button>
        </div>
      )}
    </div>
  )
}
