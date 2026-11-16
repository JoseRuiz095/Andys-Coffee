import { useRef, useState } from 'react'
import { sileo } from 'sileo'
import { TableSkeleton } from '../../../shared/components/TableSkeleton'
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import { getErrorMessage } from '../../../shared/utils/errors'
import { hasPermission } from '../../auth/utils/permissions'
import { useReplenishment } from '../hooks/useInventory'
import { useCreatePurchase } from '../hooks/usePurchases'
import { useCurrentUser } from '../../auth/hooks/useCurrentUser'
import { navigateTo } from '../../../app/navigation'
import { PageHeader } from '../../../shared/components/PageHeader'

const PERIODS = [7, 14, 30] as const

const inputStyle = {
  borderColor: 'var(--color-border)',
  backgroundColor: 'var(--color-input-bg)',
  color: 'var(--color-input-text)',
}

const formatQuantity = (value: number) => value.toLocaleString('es-MX', { maximumFractionDigits: 2 })

/**
 * Restock suggestions (plan F7): ingredients at their minimum or running out, with the
 * quantity to reach their target. Selected lines become draft purchases (one per supplier) that
 * are received from "Entradas".
 */
export function InventoryReplenishment() {
  const canCreate = hasPermission(useCurrentUser(), 'inventory.create_entry')
  const [days, setDays] = useState<(typeof PERIODS)[number]>(14)
  const { data: suggestions = [], isLoading, error } = useReplenishment(days)
  const createPurchase = useCreatePurchase()
  // Edits keyed by ingredient: selection, quantity and unit cost as typed.
  const [edits, setEdits] = useState<Record<string, { selected?: boolean; quantity?: string; unitCost?: string }>>({})
  const [isCreating, setIsCreating] = useState(false)
  // Guards a second click before React re-renders with isCreating.
  const creatingRef = useRef(false)
  // The server keeps suggesting an ingredient until its purchase is received, so lines already
  // sent to a draft start unselected: clicking again must not create duplicate drafts.
  const [draftedIds, setDraftedIds] = useState<Set<string>>(() => new Set())

  const rowState = (row: (typeof suggestions)[number]) => ({
    selected: edits[row.ingredientId]?.selected ?? !draftedIds.has(row.ingredientId),
    quantity: edits[row.ingredientId]?.quantity ?? String(row.suggestedQuantity),
    unitCost: edits[row.ingredientId]?.unitCost ?? String(row.unitCost),
  })
  const edit = (id: string, patch: { selected?: boolean; quantity?: string; unitCost?: string }) =>
    setEdits((current) => ({ ...current, [id]: { ...current[id], ...patch } }))

  const selected = suggestions
    .map((row) => ({ row, state: rowState(row) }))
    .filter(({ state }) => state.selected && Number(state.quantity) > 0)
  const total = selected.reduce((sum, { state }) => sum + Number(state.quantity) * (Number(state.unitCost) || 0), 0)

  const handleCreateDrafts = async () => {
    if (creatingRef.current) return
    // An empty cost is "not typed", not $0.
    if (selected.some(({ state }) => state.unitCost.trim() === '' || !(Number(state.unitCost) >= 0))) {
      sileo.error({ title: 'Revisa los costos', description: 'El costo unitario debe ser un número mayor o igual a cero.' })
      return
    }
    // One draft per last supplier (lines without one go together, without supplier).
    const groups = new Map<string, typeof selected>()
    for (const line of selected) {
      const key = line.row.lastSupplier?.id ?? ''
      groups.set(key, [...(groups.get(key) ?? []), line])
    }
    creatingRef.current = true
    setIsCreating(true)
    let created = 0
    try {
      for (const [supplierId, lines] of groups) {
        await createPurchase.mutateAsync({
          ...(supplierId && { supplierId }),
          notes: `Sugerencia de reabastecimiento (consumo de ${days} días)`,
          items: lines.map(({ row, state }) => ({
            ingredientId: row.ingredientId,
            quantity: Number(state.quantity),
            unitCost: Number(state.unitCost),
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
          <label className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
            Consumo de los últimos{' '}
            <select
              value={days}
              onChange={(event) => setDays(Number(event.target.value) as (typeof PERIODS)[number])}
              className="rounded-lg border px-2 py-1"
              style={inputStyle}
            >
              {PERIODS.map((period) => <option key={period} value={period}>{period} días</option>)}
            </select>
          </label>
        }
      />

      {isLoading ? (
        <TableSkeleton rows={5} columns={8} />
      ) : error ? (
        <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{getErrorMessage(error, 'No se pudieron cargar las sugerencias.')}</p>
      ) : suggestions.length === 0 ? (
        <p className="rounded-lg border p-6 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
          No hay insumos por reabastecer.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                <th className="px-3 py-2" aria-label="Incluir" />
                <th className="px-3 py-2 text-left font-medium">Insumo</th>
                <th className="px-3 py-2 text-right font-medium">Cobertura</th>
                <th className="px-3 py-2 text-left font-medium">Comprar</th>
                <th className="px-3 py-2 text-left font-medium">Costo unit.</th>
                <th className="px-3 py-2 text-left font-medium">Último proveedor</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((row) => {
                const state = rowState(row)
                return (
                  <tr key={row.ingredientId} style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={state.selected}
                        onChange={(event) => edit(row.ingredientId, { selected: event.target.checked })}
                        aria-label={`Incluir ${row.name}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      {row.name}
                      <span className="ml-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{row.sku}</span>
                      <div className="text-sm" style={{ color: row.currentStock <= 0 ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                        Hay {formatQuantity(row.currentStock)} {row.unit}
                      </div>
                      {draftedIds.has(row.ingredientId) && (
                        <span className="ml-2 rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)' }}>
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
                      className="px-3 py-2 text-right"
                      title={`Consumo: ${formatQuantity(row.dailyConsumption)} ${row.unit}/día · Mín ${formatQuantity(row.minimumStock)} / Máx ${row.maximumStock === null ? '—' : formatQuantity(row.maximumStock)}`}
                    >
                      <div>{row.coverageDays === null ? '—' : `${row.coverageDays} días`}</div>
                      <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {formatQuantity(row.dailyConsumption)} {row.unit}/día · mín {formatQuantity(row.minimumStock)}
                        {row.maximumStock === null ? '' : ` · máx ${formatQuantity(row.maximumStock)}`}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={state.quantity}
                        disabled={!canCreate}
                        onChange={(event) => edit(row.ingredientId, { quantity: event.target.value })}
                        className="w-24 rounded-lg border px-2 py-1"
                        style={inputStyle}
                        aria-label={`Cantidad a comprar de ${row.name}`}
                      />
                      <span className="ml-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{row.unit}</span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={state.unitCost}
                        disabled={!canCreate}
                        onChange={(event) => edit(row.ingredientId, { unitCost: event.target.value })}
                        className="w-24 rounded-lg border px-2 py-1"
                        style={inputStyle}
                        aria-label={`Costo unitario de ${row.name}`}
                      />
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--color-text-secondary)' }}>
                      {row.lastSupplier?.name ?? 'Sin compras'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {suggestions.length > 0 && canCreate && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {selected.length} insumo(s) · estimado {formatCurrency(total)}
          </span>
          <button
            type="button"
            onClick={handleCreateDrafts}
            disabled={selected.length === 0 || isCreating}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-[var(--color-button-text)] disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {isCreating ? 'Creando…' : 'Crear borradores de compra'}
          </button>
        </div>
      )}
    </div>
  )
}
