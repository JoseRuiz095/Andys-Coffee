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

const TAILWIND_INPUT_CLASS =
  'w-full rounded-lg border border-[var(--color-border)] px-3 py-2 transition-colors focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 bg-[var(--color-input-bg)] text-[var(--color-input-text)]'



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
    <div
     
    >
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <PageHeader title="Salidas" description="Mermas, muestras, consumo interno o donaciones." />

        {/* Formulario */}
        {!canCreateExit && <PermissionNotice action="registrar salidas" />}

        {canCreateExit && (
        <div
          className="mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
        >
          <>
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">Registrar Salida</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Ingrediente */}
            <div>
              <label htmlFor="exit-ingredient" className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">Ingrediente</label>
              {isLoadingIngredients ? (
                <Skeleton className="h-10" />
              ) : (
                <>
                <input
                  type="search"
                  value={ingredientFilter}
                  onChange={(e) => setIngredientFilter(e.target.value)}
                  placeholder="Buscar por nombre o SKU"
                  aria-label="Buscar ingrediente"
                  className={`${TAILWIND_INPUT_CLASS} mb-2`}
                />
                <select
                  id="exit-ingredient"
                  value={selectedIngredientId}
                  onChange={(e) => setSelectedIngredientId(e.target.value)}
                  className={TAILWIND_INPUT_CLASS}
                >
                  <option value="">Selecciona un ingrediente</option>
                  {ingredientOptions.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({Number(ing.currentStock).toFixed(2)} {ing.unit.abbreviation})
                    </option>
                  ))}
                </select>
                </>
              )}
            </div>

            {/* Cantidad */}
            <div>
              <label htmlFor="exit-quantity" className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">Cantidad</label>
              <input
                id="exit-quantity"
                type="number"
                step="0.01"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0.00"
                aria-describedby={selectedIngredient ? 'exit-available' : undefined}
                className={TAILWIND_INPUT_CLASS}
              />
              {selectedIngredient && (
                <p id="exit-available" className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Disponible: <strong className="text-[var(--color-text-primary)]">{Number(selectedIngredient.currentStock).toFixed(2)} {selectedIngredient.unit.abbreviation}</strong>
                </p>
              )}
            </div>

            {/* Motivo */}
            <div>
              <label htmlFor="exit-reason" className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">Motivo</label>
              <select
                id="exit-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value as ExitReason)}
                className={TAILWIND_INPUT_CLASS}
              >
                {Object.entries(EXIT_REASON_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* Notas (opcional): collapsed until needed */}
          <div className="mt-4">
            {showNotes || notes ? (
              <>
                <label htmlFor="exit-notes" className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">Notas (opcional)</label>
                <textarea
                  id="exit-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Se rompió el empaque, producto defectuoso..."
                  maxLength={500}
                  rows={3}
                  className={`${TAILWIND_INPUT_CLASS} resize-none`}
                />
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{notes.length}/500</p>
              </>
            ) : (
              <button type="button" onClick={() => setShowNotes(true)} className="text-sm font-medium text-[var(--color-primary)] hover:underline">
                + Agregar notas
              </button>
            )}
          </div>

          {/* Botón */}
          <button
            onClick={handleAddExit}
            disabled={isCreatingExit || !selectedIngredientId || !quantity}
            className="mt-6 rounded-lg bg-[var(--color-primary)] px-6 py-2 text-[var(--color-button-text)] font-medium transition-colors hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCreatingExit ? 'Registrando...' : 'Registrar Salida'}
          </button>
          </>
        </div>
        )}

        {/* Salidas Recientes */}
        <div
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
        >
          <div className="border-b border-[var(--color-border)] px-6 py-4">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Salidas Recientes</h2>
          </div>

          {isLoadingMovements ? (
            <div className="space-y-3 p-6">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : !movementsData?.data?.length ? (
            <div className="p-8 text-center">
              <p className="text-[var(--color-text-secondary)]">No hay salidas registradas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-[var(--color-text-primary)]">Fecha</th>
                    <th className="px-6 py-3 text-left font-semibold text-[var(--color-text-primary)]">
                      Ingrediente
                    </th>
                    <th className="px-6 py-3 text-center font-semibold text-[var(--color-text-primary)]">Tipo</th>
                    <th className="px-6 py-3 text-right font-semibold text-[var(--color-text-primary)]">Cantidad</th>
                    <th className="px-6 py-3 text-left font-semibold text-[var(--color-text-primary)]">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {movementsData?.data?.map((movement) => (
                    <tr
                      key={movement.id}
                      className="transition-colors hover:bg-[var(--color-surface-hover)]"
                    >
                      <td className="px-6 py-4 text-[var(--color-text-secondary)]">
                        {new Date(movement.createdAt).toLocaleDateString('es-MX', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-[var(--color-text-primary)]">{movement.ingredient.name}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {movement.ingredient.sku || '—'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getMovementTypeColor(movement.type)}`}
                        >
                          {getMovementTypeLabel(movement.type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-[var(--color-danger)]">
                          {Number(movement.quantity).toFixed(2)}{' '}
                          <span className="text-[var(--color-text-secondary)]">{movement.ingredient.unit.abbreviation}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--color-text-secondary)]">{movement.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

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
    </div>
  )
}
