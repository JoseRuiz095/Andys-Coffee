import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { sileo } from 'sileo'
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
  const [unitId, setUnitId] = useState('')
  const [similarSearch, setSimilarSearch] = useState('')

  const { data: units, isLoading: isLoadingUnits } = useInventoryUnits()
  const { data: similarResults, isLoading: isSearching } = useSearchIngredients(
    showSimilarMatches && similarSearch.length >= 2 ? similarSearch : ''
  )
  const { data: editingIngredient } = useInventoryById(
    editingIngredientId || ''
  )
  const { mutate: createIngredient, isPending: isCreating } = useCreateIngredient()
  const { mutate: updateIngredient, isPending: isUpdating } = useUpdateIngredient()

  useEffect(() => {
    if (editingIngredient && isOpen) {
      const timer = setTimeout(() => {
        setName(editingIngredient.name)
        setSku(editingIngredient.sku || '')
        setMinimumStock(editingIngredient.minimumStock ? Number(editingIngredient.minimumStock).toString() : '')
        setUnitId(editingIngredient.unit?.id || '')
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [editingIngredient, isOpen])

  useEffect(() => {
    if (isOpen) {
      firstInputRef.current?.focus()
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose()
        }
      }
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

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

    const data = {
      name: name.trim(),
      sku: sku.trim() || undefined,
      unitId,
      minimumStock: minimumStock ? parseFloat(minimumStock) : undefined,
    }

    if (editingIngredientId) {
      updateIngredient(
        {
          id: editingIngredientId,
          data: {
            name: data.name,
            sku: data.sku,
            minimumStock: data.minimumStock,
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
          const status = getErrorStatus(error)
          let message = getErrorMessage(error, 'Error creando ingrediente')

          if (status === 409) {
            message = 'Este SKU ya existe. Verifica los ingredientes existentes o usa un SKU diferente.'
          }

          sileo.error({ title: 'Error', description: message })
        },
      })
    }
  }

  const handleClose = () => {
    setName('')
    setSku('')
    setMinimumStock('')
    setUnitId('')
    setSimilarSearch('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <motion.div
        className="w-full max-w-md rounded-lg shadow-lg"
        style={{ backgroundColor: 'var(--color-surface)' }}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ingredient-modal-title"
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <h2 id="ingredient-modal-title" className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {editingIngredientId ? 'Editar Ingrediente' : 'Crear Ingrediente'}
          </h2>

          {/* Búsqueda de similares */}
          {showSimilarMatches && !editingIngredientId && name.length >= 2 && (
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="mb-2 text-xs font-medium text-blue-900">Ingredientes similares encontrados:</p>
              {isSearching ? (
                <p className="text-xs text-blue-700">Buscando...</p>
              ) : similarResults && similarResults.length > 0 ? (
                <ul className="space-y-1">
                  {similarResults.map((ing) => (
                    <li key={ing.id} className="flex items-center justify-between text-xs text-blue-700">
                      <span>
                        {ing.name} ({ing.sku || 'sin SKU'})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          handleClose()
                          onSuccess?.(ing)
                        }}
                        className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                      >
                        Usar este
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-blue-700">No hay similares</p>
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
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>SKU (opcional)</label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="Ej: CAF-001"
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
              <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Unidad *</label>
              <select
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
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Stock Mínimo (opcional)</label>
            <input
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
              className="flex-1 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
            >
              {isCreating || isUpdating ? 'Guardando...' : editingIngredientId ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
