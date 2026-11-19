import { useState } from 'react'
import { PermissionNotice } from '../../../shared/components/PermissionNotice'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { sileo } from 'sileo'
import { Skeleton } from '../../../shared/components/Skeleton'
import { useCreateExit } from '../hooks/useInventoryExits'
import { useInventoryList } from '../hooks/useInventory'
import { useInventoryMovements } from '../hooks/useInventory'
import { EXIT_REASON_LABELS, type ExitReason } from '../api/inventory-exits.api'
import { getErrorMessage } from '../../../shared/utils/errors'
import { getMovementTypeColor, getMovementTypeLabel } from '../constants/movementTypes'
import { useCurrentUser } from '../../auth/hooks/useCurrentUser'
import { PageHeader } from '../../../shared/components/PageHeader'
import { TableSkeleton } from '../../../shared/components/TableSkeleton'
import { formatDayAndTime } from '../../../shared/utils/dateUtils'
import { FORM_FIELD_CLASS, FORM_LABEL_CLASS } from '../../../shared/constants/fieldStyles'
import { ACTION_LINK_CLASS, ACTION_PRIMARY_CLASS } from '../../../shared/constants/actionStyles'
import { CELL_SECONDARY_CLASS, NUMERIC_CLASS, TABLE_CARD_CLASS, TABLE_CLASS, TABLE_HEAD_CLASS, TD_CLASS, TH_CLASS, TR_CLASS } from '../../../shared/constants/tableStyles'

export function InventoryExits() {
  const [selectedIngredientId, setSelectedIngredientId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState<ExitReason>('waste')
  const [notes, setNotes] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)

  const user = useCurrentUser()
  const canCreateExit = user?.permissions?.includes('inventory.create_exit')

  const { data: ingredientsData, isLoading: isLoadingIngredients } = useInventoryList({
    page: 1,
    limit: 1000,
    isActive: true,
  })
  // Narrows the long ingredient list; the selected one stays listed even if it doesn't match.
  const [ingredientFilter, setIngredientFilter] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const filterTerm = ingredientFilter.trim().toLowerCase()
  const ingredientOptions = (ingredientsData?.data ?? []).filter(
    (ing) =>
      !filterTerm ||
      ing.id === selectedIngredientId ||
      ing.name.toLowerCase().includes(filterTerm) ||
      (ing.sku ?? '').toLowerCase().includes(filterTerm),
  )

  const { data: movementsData, isLoading: isLoadingMovements } = useInventoryMovements({
    page: 1,
    limit: 10,
    type: 'exit',
  })

  const { mutate: createExit, isPending: isCreatingExit } = useCreateExit()

  const selectedIngredient = ingredientsData?.data?.find(
    (ing) => ing.id === selectedIngredientId
  )

  const handleAddExit = () => {
    if (!selectedIngredientId) {
      sileo.error({ title: 'Ingrediente requerido', description: 'Selecciona un ingrediente.' })
      return
    }

    if (!quantity || parseFloat(quantity) <= 0) {
      sileo.error({ title: 'Cantidad inválida', description: 'Ingresa una cantidad mayor a cero.' })
      return
    }

    setIsConfirming(true)
  }

  const handleConfirmExit = () => {
    const qty = parseFloat(quantity)

    // Stock may go negative (sales never block): a real waste is recorded anyway and the
    // confirmation warns about it; a physical count fixes the stock later.
    if (!selectedIngredient) {
      setIsConfirming(false)
      return
    }

    createExit(
      {
        ingredientId: selectedIngredientId,
        quantity: qty,
        reason,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          sileo.success({ title: 'Salida registrada', duration: 2000 })
          setSelectedIngredientId('')
          setQuantity('')
          setReason('waste')
          setNotes('')
          setIsConfirming(false)
        },
        onError: (error: unknown) => {
          sileo.error({
            title: 'Error registrando salida',
            description: getErrorMessage(error, 'Intenta de nuevo'),
          })
        },
      }
    )
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Salidas" description="Mermas, muestras, consumo interno o donaciones." />

      {!canCreateExit && <PermissionNotice action="registrar salidas" />}

      {/* Formulario: ingredient, quantity, reason and the action in one row on wide screens. */}
      {canCreateExit && (
      <section aria-labelledby="exit-form-title" className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 id="exit-form-title" className="mb-3 text-base font-semibold text-[var(--color-text-primary)]">Registrar salida</h2>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          {/* Ingrediente: the search narrows the select right below it. */}
          <div>
            <label htmlFor="exit-ingredient" className={FORM_LABEL_CLASS}>Ingrediente</label>
            {isLoadingIngredients ? (
              <Skeleton className="h-10" />
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="search"
                  value={ingredientFilter}
                  onChange={(e) => setIngredientFilter(e.target.value)}
                  placeholder="Filtrar: nombre o SKU"
                  aria-label="Buscar ingrediente"
                  className={FORM_FIELD_CLASS}
                />
                <select
                  id="exit-ingredient"
                  value={selectedIngredientId}
                  onChange={(e) => setSelectedIngredientId(e.target.value)}
                  className={FORM_FIELD_CLASS}
                >
                  <option value="">Selecciona un ingrediente</option>
                  {ingredientOptions.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({Number(ing.currentStock).toFixed(2)} {ing.unit.abbreviation})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Cantidad */}
          <div>
            <label htmlFor="exit-quantity" className={FORM_LABEL_CLASS}>Cantidad</label>
            <input
              id="exit-quantity"
              type="number"
              step="0.01"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.00"
              aria-describedby={selectedIngredient ? 'exit-available' : undefined}
              className={`${FORM_FIELD_CLASS} tabular-nums`}
            />
            {selectedIngredient && (
              <p id="exit-available" className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Disponible: <strong className="tabular-nums text-[var(--color-text-primary)]">{Number(selectedIngredient.currentStock).toFixed(2)} {selectedIngredient.unit.abbreviation}</strong>
              </p>
            )}
          </div>

          {/* Motivo */}
          <div>
            <label htmlFor="exit-reason" className={FORM_LABEL_CLASS}>Motivo</label>
            <select
              id="exit-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as ExitReason)}
              className={FORM_FIELD_CLASS}
            >
              {Object.entries(EXIT_REASON_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Botón: aligned with the fields (the label row is left empty). */}
          <div className="text-sm md:pt-6">
            <button
              type="button"
              onClick={handleAddExit}
              disabled={isCreatingExit || !selectedIngredientId || !quantity}
              className={`${ACTION_PRIMARY_CLASS} w-full md:w-auto`}
            >
              {isCreatingExit ? 'Registrando...' : 'Registrar salida'}
            </button>
          </div>
        </div>

        {/* Notas (opcional): collapsed until needed */}
        <div className="mt-3">
          {showNotes || notes ? (
            <>
              <label htmlFor="exit-notes" className={FORM_LABEL_CLASS}>
                Notas <span className="font-normal text-[var(--color-text-secondary)]">(opcional)</span>
              </label>
              <textarea
                id="exit-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Se rompió el empaque, producto defectuoso..."
                maxLength={500}
                rows={2}
                className={`${FORM_FIELD_CLASS} resize-none`}
              />
              <p className="mt-1 text-right text-[0.8125rem] tabular-nums text-[var(--color-text-secondary)]">{notes.length}/500</p>
            </>
          ) : (
            <button type="button" onClick={() => setShowNotes(true)} className={`${ACTION_LINK_CLASS} text-sm`}>
              + Agregar notas
            </button>
          )}
        </div>
      </section>
      )}

      {/* Salidas recientes */}
      <section aria-labelledby="exit-recent-title" className={TABLE_CARD_CLASS}>
        <h2 id="exit-recent-title" className="border-b border-[var(--color-border)] px-4 py-3 text-base font-semibold text-[var(--color-text-primary)]">
          Salidas recientes
        </h2>

        {isLoadingMovements ? (
          <TableSkeleton rows={5} columns={5} />
        ) : !movementsData?.data?.length ? (
          <p className="px-4 py-6 text-center text-sm text-[var(--color-text-secondary)]">No hay salidas registradas</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={TABLE_CLASS}>
              <thead className={TABLE_HEAD_CLASS}>
                <tr>
                  <th className={`${TH_CLASS} text-left`}>Fecha</th>
                  <th className={`${TH_CLASS} text-left`}>Ingrediente</th>
                  <th className={`${TH_CLASS} text-center`}>Tipo</th>
                  <th className={`${TH_CLASS} text-right`}>Cantidad</th>
                  <th className={`${TH_CLASS} text-left`}>Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {movementsData?.data?.map((movement) => (
                  <tr key={movement.id} className={TR_CLASS}>
                    <td className={`${TD_CLASS} whitespace-nowrap text-[var(--color-text-secondary)]`}>
                      {formatDayAndTime(movement.createdAt)}
                    </td>
                    <td className={TD_CLASS}>
                      <p className="font-medium text-[var(--color-text-primary)]">{movement.ingredient.name}</p>
                      <p className={CELL_SECONDARY_CLASS}>{movement.ingredient.sku || '—'}</p>
                    </td>
                    <td className={`${TD_CLASS} text-center`}>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.8125rem] font-medium ${getMovementTypeColor(movement.type)}`}>
                        {getMovementTypeLabel(movement.type)}
                      </span>
                    </td>
                    <td className={`${TD_CLASS} ${NUMERIC_CLASS} font-medium text-[var(--color-danger)]`}>
                      {Number(movement.quantity).toFixed(2)}{' '}
                      <span className="font-normal text-[var(--color-text-secondary)]">{movement.ingredient.unit.abbreviation}</span>
                    </td>
                    <td className={`${TD_CLASS} text-[var(--color-text-secondary)]`}>{movement.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        isOpen={isConfirming}
        title="Confirmar Salida"
        message={`¿Descontar ${parseFloat(quantity || '0').toFixed(2)} ${selectedIngredient?.unit.abbreviation ?? ''} de ${selectedIngredient?.name ?? ''}?${
          selectedIngredient && parseFloat(quantity || '0') > Number(selectedIngredient.currentStock)
            ? ` Es más de lo disponible (${Number(selectedIngredient.currentStock).toFixed(2)}): el stock quedará en negativo hasta el próximo conteo.`
            : ''
        }`}
        confirmText="Confirmar"
        isDangerous
        isLoading={isCreatingExit}
        onConfirm={handleConfirmExit}
        onCancel={() => setIsConfirming(false)}
      >
        {notes && (
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            <span className="font-medium">Notas:</span> {notes}
          </p>
        )}
      </ConfirmDialog>
    </div>
  )
}
