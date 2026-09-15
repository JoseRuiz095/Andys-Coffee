import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { sileo } from 'sileo'
import { useCreateIngredient, useUpdateIngredient, useSearchIngredients, useInventoryUnits, useInventoryById } from '../hooks/useInventory'

interface IngredientFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (ingredient: any) => void
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
          onError: (error: any) => {
            const message =
              error?.response?.data?.message || error?.message || 'Error actualizando ingrediente'
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
        onError: (error: any) => {
          const message =
            error?.response?.data?.message || error?.message || 'Error creando ingrediente'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <motion.div
        className="w-full max-w-md rounded-lg bg-white shadow-lg"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <h2 className="text-lg font-semibold text-gray-900">
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Nombre *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setSimilarSearch(e.target.value)
              }}
              placeholder="Ej: Café en grano"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-[#5A804F] focus:ring-2 focus:ring-[#5A804F]/20"
            />
          </div>

          {/* SKU */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">SKU (opcional)</label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="Ej: CAF-001"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-[#5A804F] focus:ring-2 focus:ring-[#5A804F]/20"
            />
          </div>

          {/* Unidad */}
          {!editingIngredientId && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Unidad *</label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-[#5A804F] focus:ring-2 focus:ring-[#5A804F]/20"
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Stock Mínimo (opcional)</label>
            <input
              type="number"
              value={minimumStock}
              onChange={(e) => setMinimumStock(e.target.value)}
              placeholder="0"
              step="0.01"
              min="0"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-[#5A804F] focus:ring-2 focus:ring-[#5A804F]/20"
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isCreating || isUpdating}
              className="flex-1 rounded-lg bg-[#5A804F] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a6a3f] disabled:opacity-50"
            >
              {isCreating || isUpdating ? 'Guardando...' : editingIngredientId ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
