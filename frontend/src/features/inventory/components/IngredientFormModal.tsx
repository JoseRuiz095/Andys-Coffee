import { useState, useRef } from 'react'
import { sileo } from 'sileo'
import { Modal } from '../../../shared/components/Modal'
import { useCreateIngredient, useUpdateIngredient, useSearchIngredients, useInventoryUnits, useInventoryById } from '../hooks/useInventory'
import { getErrorMessage, getErrorStatus } from '../../../shared/utils/errors'
import type { InventoryIngredient } from '../api/inventory.api'

interface IngredientFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (ingredient: InventoryIngredient) => void
  initialName?: string
  editingIngredientId?: string | null
  showSimilarMatches?: boolean
}

export function IngredientFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialName = '',
  editingIngredientId = null,
  showSimilarMatches = true,
}: IngredientFormModalProps) {
  const firstInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(initialName)
  const [sku, setSku] = useState('')
  const [minimumStock, setMinimumStock] = useState('')
  const [maximumStock, setMaximumStock] = useState('')
  const [unitId, setUnitId] = useState('')
  // Starts with the name typed in the search that opened the modal, so matches show at once.
  const [similarSearch, setSimilarSearch] = useState(initialName)

  const { data: allUnits, isLoading: isLoadingUnits } = useInventoryUnits()
  // Stock is kept in base units (gr, ml, pz); kg and lt are only for capturing purchases.
  const units = allUnits?.filter((unit) => Number(unit.factor) === 1)
  const { data: similarResults, isLoading: isSearching } = useSearchIngredients(
    showSimilarMatches && similarSearch.length >= 2 ? similarSearch : ''
  )
  const { data: editingIngredient } = useInventoryById(
    editingIngredientId || ''
  )
  const { mutate: createIngredient, isPending: isCreating } = useCreateIngredient()
  const { mutate: updateIngredient, isPending: isUpdating } = useUpdateIngredient()

  // Callers mount the modal per opening (keyed by the ingredient), so the form is filled once
  // when the edited ingredient arrives, during render instead of in an effect.
  const [loadedIngredientId, setLoadedIngredientId] = useState<string | null>(null)
  if (editingIngredient && editingIngredient.id === editingIngredientId && loadedIngredientId !== editingIngredient.id) {
    setLoadedIngredientId(editingIngredient.id)
    setName(editingIngredient.name)
    setSku(editingIngredient.sku || '')
    setMinimumStock(editingIngredient.minimumStock ? Number(editingIngredient.minimumStock).toString() : '')
    setMaximumStock(
      editingIngredient.maximumStock !== null && editingIngredient.maximumStock !== undefined
        ? Number(editingIngredient.maximumStock).toString()
        : '',
    )
    setUnitId(editingIngredient.unit?.id || '')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      sileo.error({ title: 'Nombre requerido', description: 'Ingresa un nombre para el ingrediente.' })
      return
    }

    if (!unitId) {
      sileo.error({ title: 'Unidad requerida', description: 'Selecciona una unidad de medida.' })
      return
    }

    // Empty minimum = 0 (also when editing: clearing it must be able to set it back to 0).
    const minimum = minimumStock.trim() ? Number(minimumStock) : 0
    const maximum = maximumStock.trim() ? Number(maximumStock) : null
    if (!Number.isFinite(minimum) || minimum < 0) {
      sileo.error({ title: 'Stock mínimo inválido', description: 'El stock mínimo debe ser un número mayor o igual a 0.' })
      return
    }
    if (maximum !== null && (!Number.isFinite(maximum) || maximum < 0)) {
      sileo.error({ title: 'Stock máximo inválido', description: 'El stock máximo debe ser un número mayor o igual a 0.' })
      return
    }
    if (maximum !== null && maximum < minimum) {
      sileo.error({ title: 'Stock máximo inválido', description: 'El stock máximo no puede ser menor que el mínimo.' })
      return
    }

    const data = {
      name: name.trim(),
      sku: sku.trim() || undefined,
      unitId,
      minimumStock: minimum,
      maximumStock: maximum,
    }

    if (editingIngredientId) {
      updateIngredient(
        {
          id: editingIngredientId,
          data: {
            name: data.name,
            sku: data.sku,
            minimumStock: data.minimumStock,
            maximumStock: data.maximumStock,
          },
        },
        {
          onSuccess: (response) => {
            sileo.success({ title: 'Ingrediente actualizado', duration: 2000 })
            onSuccess?.(response.ingredient)
            handleClose()
          },
          onError: (error: unknown) => {
            const message =
              getErrorMessage(error, 'Error actualizando ingrediente')
            sileo.error({ title: 'Error', description: message })
          },
        }
      )
    } else {
      createIngredient(data, {
        onSuccess: (response) => {
          sileo.success({ title: 'Ingrediente creado', duration: 2000 })
          onSuccess?.(response.ingredient)
          handleClose()
        },
        onError: (error: unknown) => {
          // 409 = duplicate name or SKU; the server message says which one.
          const title = getErrorStatus(error) === 409 ? 'Ingrediente duplicado' : 'Error'
          sileo.error({ title, description: getErrorMessage(error, 'Error creando ingrediente') })
        },
      })
    }
  }

  const handleClose = () => {
    setName('')
    setSku('')
    setMaximumStock('')
    setMinimumStock('')
    setUnitId('')
    setSimilarSearch('')
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      ariaLabelledBy="ingredient-modal-title"
      initialFocusRef={firstInputRef}
    >
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <h2 id="ingredient-modal-title" className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {editingIngredientId ? 'Editar Ingrediente' : 'Crear Ingrediente'}
          </h2>

          {/* Búsqueda de similares */}
          {showSimilarMatches && !editingIngredientId && name.length >= 2 && (
            <div className="rounded-lg border border-[var(--color-info)]/40 bg-[var(--color-info)]/10 p-3">
              <p className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">Ingredientes similares encontrados:</p>
              {isSearching ? (
                <p className="text-sm text-[var(--color-text-secondary)]">Buscando...</p>
              ) : similarResults && similarResults.length > 0 ? (
                <ul className="space-y-1">
                  {similarResults.map((ing) => (
                    <li key={ing.id} className="flex items-center justify-between gap-3 text-sm text-[var(--color-text-secondary)]">
                      <span>
                        {ing.name} ({ing.sku || 'sin SKU'})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          handleClose()
                          onSuccess?.(ing)
                        }}
                        className="min-h-9 shrink-0 rounded-lg border border-[color-mix(in_srgb,var(--color-info)_45%,var(--color-border))] px-3 font-medium text-[var(--color-info)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-info)_10%,var(--color-surface))] pointer-coarse:min-h-11"
                      >
                        Usar este
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--color-text-secondary)]">No hay similares</p>
              )}
            </div>
          )}

          {/* Nombre */}
          <div>
            <label htmlFor="ingredient-name" className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Nombre *</label>
            <input
              id="ingredient-name"
              ref={firstInputRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setSimilarSearch(e.target.value)
              }}
              placeholder="Ej: Café en grano"
              aria-label="Nombre del ingrediente"
              aria-required="true"
              className="w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)]/20"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)'
              }}
            />
          </div>

          {/* SKU */}
          <div>
            <label htmlFor="ingredientformmodal-sku-opcional" className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>SKU (opcional)</label>
            <input
              id="ingredientformmodal-sku-opcional"
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="Se asigna INS-### si lo dejas vacío"
              className="w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)]/20"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)'
              }}
            />
          </div>

          {/* Unidad */}
          {!editingIngredientId && (
            <div>
              <label htmlFor="ingredientformmodal-unidad" className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Unidad *</label>
              <select
                id="ingredientformmodal-unidad"
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)]/20"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-primary)'
                }}
              >
                <option value="">Selecciona una unidad</option>
                {isLoadingUnits ? (
                  <option disabled>Cargando unidades...</option>
                ) : units && units.length > 0 ? (
                  units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} ({unit.abbreviation})
                    </option>
                  ))
                ) : (
                  <option disabled>No hay unidades disponibles</option>
                )}
              </select>
            </div>
          )}

          {/* Stock mínimo */}
          <div>
            <label htmlFor="ingredientformmodal-stock-minimo-opcional" className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Stock Mínimo (opcional)</label>
            <input
              id="ingredientformmodal-stock-minimo-opcional"
              type="number"
              value={minimumStock}
              onChange={(e) => setMinimumStock(e.target.value)}
              placeholder="0"
              step="0.01"
              min="0"
              className="w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)]/20"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)'
              }}
            />
          </div>

          {/* Stock máximo */}
          <div>
            <label htmlFor="ingredientformmodal-stock-maximo-opcional" className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Stock Máximo (opcional)</label>
            <input
              id="ingredientformmodal-stock-maximo-opcional"
              type="number"
              value={maximumStock}
              onChange={(e) => setMaximumStock(e.target.value)}
              placeholder="Sin definir (2 × mínimo)"
              step="0.01"
              min="0"
              className="w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)]/20"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)'
              }}
            />
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Nivel al que se sugiere reabastecer.
            </p>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:opacity-80"
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isCreating || isUpdating}
              className="flex-1 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-button-text)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
            >
              {isCreating || isUpdating ? 'Guardando...' : editingIngredientId ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
    </Modal>
  )
}
