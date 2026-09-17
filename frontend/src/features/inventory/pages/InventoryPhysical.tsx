import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sileo } from 'sileo'
import { Skeleton } from '../../../shared/components/Skeleton'
import { PencilIcon } from '../../../components/ui/PencilIcon'
import { XIcon } from '../../../components/ui/XIcon'
import {
  useCreateCount,
  useGetCount,
  useAddItem,
  useRemoveItem,
  useCompleteCount,
  useApplyAdjustments,
  useDeleteCount,
  useCountsList,
} from '../hooks/useInventoryCounts'
import { useInventoryList } from '../hooks/useInventory'
import { authStore } from '../../auth/store/auth.store'
import axios from 'axios'

const ACTIVE_COUNT_STORAGE_KEY = 'activeInventoryCountId'

function readStoredCountId(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_COUNT_STORAGE_KEY)
  } catch {
    return null
  }
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ message?: string; errors?: unknown }>(error)) {
    const data = error.response?.data
    if (data?.errors) {
      const details = typeof data.errors === 'string' ? data.errors : JSON.stringify(data.errors)
      return `${data.message ?? 'Error de validación.'}: ${details}`
    }
    return data?.message ?? error.message
  }
  return error instanceof Error ? error.message : fallback
}

export function InventoryPhysical() {
  const { user } = authStore.getState()
  const canCount = user?.permissions?.includes('inventory.physical_count') ?? false
  const canAdjust = user?.permissions?.includes('inventory.adjust') ?? false

  const [countId, setCountId] = useState<string | null>(() => readStoredCountId())
  const [selectedIngredientId, setSelectedIngredientId] = useState('')
  const [selectedIngredientData, setSelectedIngredientData] = useState<{ name: string; unit?: { abbreviation: string } } | null>(null)
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [showIngredientResults, setShowIngredientResults] = useState(false)
  const [countedQty, setCountedQty] = useState('')
  const [notes, setNotes] = useState('')
  const [isConfirmingApply, setIsConfirmingApply] = useState(false)
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)
  const [isConfirmingDeleteCount, setIsConfirmingDeleteCount] = useState(false)
  const [countsPage, setCountsPage] = useState(1)
  const [countsStatusFilter, setCountsStatusFilter] = useState('all')
  const [countsDateFilter, setCountsDateFilter] = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => {
    try {
      if (countId) {
        sessionStorage.setItem(ACTIVE_COUNT_STORAGE_KEY, countId)
      } else {
        sessionStorage.removeItem(ACTIVE_COUNT_STORAGE_KEY)
      }
    } catch {
      // sessionStorage unavailable (private mode, etc.) - ignore
    }
  }, [countId])

  const { mutate: createCount, isPending: isCreating } = useCreateCount()
  const { data: count, isLoading: isLoadingCount } = useGetCount(countId)
  const { data: recentCounts, isLoading: isLoadingRecent } = useCountsList({
    page: countsPage,
    limit: 20,
    status: countsStatusFilter !== 'all' ? countsStatusFilter : undefined,
    date: countsDateFilter || undefined,
  })
  const { data: ingredients } = useInventoryList({
    page: 1,
    limit: 1000,
    status: 'all',
    search: undefined,
  })
  const { mutate: addItem, isPending: isAddingItem } = useAddItem(countId)
  const { mutate: removeItem, isPending: isRemovingItem } = useRemoveItem(countId)
  const { mutate: completeCount, isPending: isCompleting } = useCompleteCount(countId)
  const { mutate: applyAdjustments, isPending: isApplying } = useApplyAdjustments(countId)
  const { mutate: deleteCount, isPending: isDeletingCount } = useDeleteCount()

  const resetItemForm = () => {
    setSelectedIngredientId('')
    setSelectedIngredientData(null)
    setIngredientSearch('')
    setShowIngredientResults(false)
    setCountedQty('')
    setNotes('')
  }

  const handleCreateCount = () => {
    createCount(undefined, {
      onSuccess: (newCount) => {
        setCountId(newCount.id)
        resetItemForm()
        sileo.success({ title: 'Conteo creado correctamente.', duration: 3000 })
      },
      onError: (error) => {
        sileo.error({
          title: 'No se pudo crear el conteo',
          description: getApiErrorMessage(error, 'Inténtalo de nuevo.'),
        })
      },
    })
  }

  const handleSelectIngredient = (ing: { id: string; name: string; unit?: { abbreviation: string } }) => {
    setSelectedIngredientId(ing.id)
    setSelectedIngredientData({ name: ing.name, unit: ing.unit })
    setIngredientSearch('')
    setShowIngredientResults(false)

    const existing = count?.items.find((i) => i.ingredientId === ing.id)
    if (existing) {
      setCountedQty(existing.countedQuantity.toString())
      setNotes(existing.notes || '')
    } else {
      setCountedQty('')
      setNotes('')
    }
  }

  const handleEditItem = (item: { ingredientId: string; countedQuantity: number; notes: string | null; ingredient?: { name: string; unit?: { abbreviation: string } } }) => {
    setSelectedIngredientId(item.ingredientId)
    setSelectedIngredientData(item.ingredient ? { name: item.ingredient.name, unit: item.ingredient.unit } : null)
    setIngredientSearch('')
    setShowIngredientResults(false)
    setCountedQty(item.countedQuantity.toString())
    setNotes(item.notes || '')
  }

  const handleAddItem = () => {
    if (!selectedIngredientId || !countedQty) {
      sileo.error({
        title: 'Campos requeridos',
        description: 'Selecciona un ingrediente y cantidad.',
      })
      return
    }

    const isUpdating = count?.items.some((i) => i.ingredientId === selectedIngredientId) ?? false

    addItem(
      {
        ingredientId: selectedIngredientId,
        countedQuantity: parseFloat(countedQty),
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          resetItemForm()
          sileo.success({
            title: isUpdating ? 'Conteo del ingrediente actualizado.' : 'Ingrediente agregado.',
            duration: 2000,
          })
        },
        onError: (error) => {
          sileo.error({
            title: 'Error al agregar ingrediente',
            description: getApiErrorMessage(error, 'Inténtalo de nuevo.'),
          })
        },
      },
    )
  }

  const handleConfirmRemoveItem = (ingredientId: string) => {
    removeItem(ingredientId, {
      onSuccess: () => {
        setDeletingItemId(null)
        sileo.success({ title: 'Item eliminado del conteo.', duration: 2000 })
      },
      onError: (error) => {
        setDeletingItemId(null)
        sileo.error({
          title: 'No se pudo eliminar el item',
          description: getApiErrorMessage(error, 'Inténtalo de nuevo.'),
        })
      },
    })
  }

  const handleDeleteCount = () => {
    if (!countId) return
    deleteCount(countId, {
      onSuccess: () => {
        setIsConfirmingDeleteCount(false)
        setCountId(null)
        sileo.success({ title: 'Conteo eliminado.', duration: 2000 })
      },
      onError: (error) => {
        setIsConfirmingDeleteCount(false)
        sileo.error({
          title: 'No se pudo eliminar el conteo',
          description: getApiErrorMessage(error, 'Inténtalo de nuevo.'),
        })
      },
    })
  }

  const handleCompleteCount = () => {
    if (!count || count.items.length === 0) {
      sileo.error({
        title: 'Conteo vacío',
        description: 'El conteo debe tener al menos un item.',
      })
      return
    }
    completeCount(undefined, {
      onSuccess: () => {
        sileo.success({ title: 'Conteo completado correctamente.', duration: 3000 })
      },
      onError: (error) => {
        sileo.error({
          title: 'No se pudo completar el conteo',
          description: getApiErrorMessage(error, 'Inténtalo de nuevo.'),
        })
      },
    })
  }

  const handleApplyAdjustments = () => {
    if (!count) return
    const adjustmentCount = count.items.filter((i) => i.difference.toString() !== '0').length
    applyAdjustments(undefined, {
      onSuccess: () => {
        setIsConfirmingApply(false)
        sileo.success({
          title: `${adjustmentCount} ajustes aplicados.`,
          description: 'Los cambios se reflejarán en el inventario.',
          duration: 3000,
        })
      },
      onError: (error) => {
        sileo.error({
          title: 'No se pudieron aplicar los ajustes',
          description: getApiErrorMessage(error, 'Inténtalo de nuevo.'),
        })
      },
    })
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      draft: { label: '✏️ Borrador', color: 'bg-blue-100 text-blue-800' },
      completed: { label: '✓ Completado', color: 'bg-yellow-100 text-yellow-800' },
      applied: { label: '✅ Aplicado', color: 'bg-green-100 text-green-800' },
    };
    const badge = badges[status] || { label: status, color: 'bg-[var(--color-surface-secondary)] text-gray-800' };
    return <span className={`px-2 py-1 rounded-full text-sm font-medium ${badge.color}`}>{badge.label}</span>;
  };

  const getDifferenceColor = (diff: number) => {
    if (diff > 0) return 'text-[var(--color-success)] font-semibold';
    if (diff < 0) return 'text-[var(--color-danger)] font-semibold';
    return 'text-[var(--color-text-secondary)]';
  };

  if (!countId) {
    return (
      <motion.div
        className="p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="mb-6 text-2xl font-bold">Conteos Físicos</h1>

        {!canCount && (
          <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-sm font-medium text-yellow-800">
              No tienes permiso para crear o editar conteos físicos. Contacta a un administrador.
            </p>
          </div>
        )}

        <div className="rounded-lg bg-[var(--color-surface)] p-6 text-center shadow">
          <p className="mb-6 text-[var(--color-text-secondary)]">
            Crear un nuevo conteo físico para reconciliar el inventario del sistema con el real
          </p>
          <button
            onClick={handleCreateCount}
            disabled={isCreating || !canCount}
            className="rounded-lg bg-[var(--color-primary)] px-6 py-3 text-white hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {isCreating ? 'Creando...' : 'Crear nuevo conteo'}
          </button>
        </div>

        <div className="mt-6 rounded-lg bg-[var(--color-surface)] p-6 shadow">
          <h2 className="mb-4 text-lg font-bold">Conteos recientes</h2>

          {/* Filtros */}
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Estado</label>
              <select
                value={countsStatusFilter}
                onChange={(e) => {
                  setCountsStatusFilter(e.target.value)
                  setCountsPage(1)
                }}
                className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
              >
                <option value="all">Todos</option>
                <option value="draft">Borrador</option>
                <option value="completed">Completado</option>
                <option value="applied">Aplicado</option>
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Fecha</label>
              <input
                type="date"
                value={countsDateFilter}
                onChange={(e) => {
                  setCountsDateFilter(e.target.value)
                  setCountsPage(1)
                }}
                className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setCountsDateFilter('')
                  setCountsStatusFilter('all')
                  setCountsPage(1)
                }}
                className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                Ver todo el historial
              </button>
            </div>
          </div>

          {/* Lista */}
          {isLoadingRecent ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : !recentCounts?.data.length ? (
            <p className="text-sm text-[var(--color-text-secondary)]">No hay conteos registrados aún.</p>
          ) : (
            <>
              <div className="mb-4 divide-y divide-gray-200">
                {recentCounts.data.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCountId(c.id)}
                    className="flex w-full items-center justify-between py-3 text-left transition-colors hover:bg-[var(--color-surface-hover)]"
                    type="button"
                  >
                    <div>
                      <p className="font-medium text-[var(--color-text-primary)]">Conteo #{c.id.slice(0, 8)}</p>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {c.createdBy.name} · {new Date(c.createdAt).toLocaleDateString('es-ES')} ·{' '}
                        {c.items.length} item(s)
                      </p>
                    </div>
                    {getStatusBadge(c.status)}
                  </button>
                ))}
              </div>

              {/* Paginación */}
              {recentCounts.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-4">
                  <button
                    onClick={() => setCountsPage(Math.max(1, countsPage - 1))}
                    disabled={countsPage === 1}
                    className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ← Anterior
                  </button>

                  <span className="text-sm text-[var(--color-text-secondary)]">
                    Página {countsPage} de {recentCounts.pagination.totalPages}
                  </span>

                  <button
                    onClick={() => setCountsPage(Math.min(recentCounts.pagination.totalPages, countsPage + 1))}
                    disabled={countsPage === recentCounts.pagination.totalPages}
                    className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Siguiente →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    )
  }

  if (isLoadingCount) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!count) {
    return (
      <div className="p-6">
        <p className="text-[var(--color-danger)]">Conteo no encontrado</p>
      </div>
    )
  }

  const countedIngredientIds = new Set(count.items.map((i) => i.ingredientId));
  const isEditingExisting = countedIngredientIds.has(selectedIngredientId);

  const allIngredients = ingredients?.data || [];
  const filteredIngredients = (
    ingredientSearch.trim()
      ? allIngredients.filter((ing) => {
          const q = ingredientSearch.trim().toLowerCase();
          return ing.name.toLowerCase().includes(q) || (ing.sku && ing.sku.toLowerCase().includes(q));
        })
      : allIngredients
  ).filter((ing) => ing.id !== selectedIngredientId);

  return (
    <motion.div
      className="p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Conteo Físico #{count.id.slice(0, 8)}</h1>
        <div className="flex items-center gap-2">
          {getStatusBadge(count.status)}
          {count.status === 'draft' && canCount && (
            <button
              onClick={() => setIsConfirmingDeleteCount(true)}
              className="rounded-lg border border-red-300 px-4 py-2 text-[var(--color-danger)] hover:bg-red-50 transition-colors"
            >
              Cancelar conteo
            </button>
          )}
          <button
            onClick={() => setCountId(null)}
            className="rounded-lg px-4 py-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
          >
            Atrás
          </button>
        </div>
      </div>

      {/* Información del conteo */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Creado por', value: count.createdBy.name },
          { label: 'Items contados', value: count.items.length },
          {
            label: 'Diferencias',
            value: count.items.filter((i) => i.difference.toString() !== '0').length,
          },
          { label: 'Creado', value: new Date(count.createdAt).toLocaleDateString('es-ES') },
        ].map((stat, i) => (
          <motion.div
            key={i}
            className="rounded-lg bg-[var(--color-surface-secondary)] p-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <p className="text-sm text-[var(--color-text-secondary)]">{stat.label}</p>
            <p className="font-semibold">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Agregar items (si está en draft) */}
      <AnimatePresence>
        {count.status === 'draft' && (
          <motion.div
            className={`mb-6 rounded-lg bg-[var(--color-surface)] p-6 shadow ${!canCount ? 'opacity-50 pointer-events-none' : ''}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <h2 className="mb-4 text-lg font-bold">Agregar Ingrediente</h2>

            {isEditingExisting && (
              <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
                Este ingrediente ya está en el conteo — al guardar se actualizará su registro.
              </div>
            )}

            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="relative">
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
                  Ingrediente
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={selectedIngredientId ? '' : 'Buscar por nombre o SKU...'}
                    value={selectedIngredientId && selectedIngredientData ? selectedIngredientData.name : ingredientSearch}
                    onChange={(e) => {
                      setIngredientSearch(e.target.value)
                      setSelectedIngredientId('')
                      setSelectedIngredientData(null)
                      setShowIngredientResults(true)
                    }}
                    onFocus={() => setShowIngredientResults(true)}
                    onBlur={() => setTimeout(() => setShowIngredientResults(false), 150)}
                    className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 transition-colors focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                  />
                  {selectedIngredientId && (
                    <button
                      onClick={() => {
                        setSelectedIngredientId('')
                        setSelectedIngredientData(null)
                        setIngredientSearch('')
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[var(--color-text-secondary)]"
                      type="button"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <AnimatePresence>
                  {showIngredientResults && !selectedIngredientId && (
                    <motion.div
                      className="absolute top-full left-0 right-0 z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      {filteredIngredients.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                          {filteredIngredients.map((ing) => (
                            <button
                              key={ing.id}
                              onClick={() => handleSelectIngredient(ing)}
                              className="w-full px-3 py-2 text-left hover:bg-[var(--color-surface-hover)] transition-colors"
                              type="button"
                            >
                              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                                {ing.name}
                                {ing.sku && <span className="ml-1 text-xs text-[var(--color-text-secondary)]">({ing.sku})</span>}
                                {countedIngredientIds.has(ing.id) && (
                                  <span className="ml-1 text-xs font-normal text-blue-600">· ya contado</span>
                                )}
                              </p>
                              <p className="text-xs text-[var(--color-text-secondary)]">
                                Stock: {Number(ing.currentStock).toFixed(2)} {ing.unit?.abbreviation}
                              </p>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 text-center text-xs text-[var(--color-text-secondary)]">No encontramos ingredientes</div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
                  Cantidad Contada
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={countedQty}
                  onChange={(e) => setCountedQty(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 transition-colors focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
                  Notas (opcional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: dañado, encontrado en bodega..."
                  maxLength={500}
                  className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 transition-colors focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                />
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{notes.length}/500</p>
              </div>
            </div>

            <div className="flex gap-2">
              <motion.button
                onClick={handleAddItem}
                disabled={!selectedIngredientId || !countedQty || isAddingItem}
                className="rounded-lg bg-[var(--color-primary)] px-6 py-2 text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isAddingItem ? 'Guardando...' : isEditingExisting ? 'Actualizar item' : 'Agregar item'}
              </motion.button>
              {isEditingExisting && (
                <button
                  onClick={resetItemForm}
                  type="button"
                  className="rounded-lg border border-[var(--color-border)] px-6 py-2 text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
                >
                  Cancelar edición
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabla de items */}
      <div className="mb-6 overflow-hidden rounded-lg bg-[var(--color-surface)] shadow">
        <table className="w-full">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-[var(--color-text-primary)]">
                Ingrediente
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-[var(--color-text-primary)]">
                Sistema
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-[var(--color-text-primary)]">
                Contado
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-[var(--color-text-primary)]">
                Diferencia
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-[var(--color-text-primary)]">
                Notas
              </th>
              {count.status === 'draft' && (
                <th className="px-6 py-3 text-right text-sm font-medium text-[var(--color-text-primary)]">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <AnimatePresence mode="popLayout">
              {count.items.map((item, i) => (
                <motion.tr
                  key={item.ingredientId}
                  className="hover:bg-[var(--color-surface-hover)] transition-colors"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2, delay: i * 0.02 }}
                >
                  <td className="px-6 py-3">
                    <div className="font-medium">{item.ingredient?.name}</div>
                    <div className="text-sm text-[var(--color-text-secondary)]">{item.ingredient?.sku}</div>
                  </td>
                  <td className="px-6 py-3">
                    {Number(item.systemQuantity).toFixed(2)} {item.ingredient?.unit?.abbreviation}
                  </td>
                  <td className="px-6 py-3">
                    {Number(item.countedQuantity).toFixed(2)} {item.ingredient?.unit?.abbreviation}
                  </td>
                  <td className={`px-6 py-3 ${getDifferenceColor(parseFloat(item.difference.toString()))}`}>
                    {parseFloat(item.difference.toString()) > 0 ? '+' : ''}
                    {Number(item.difference).toFixed(2)} {item.ingredient?.unit?.abbreviation}
                  </td>
                  <td className="px-6 py-3 text-sm text-[var(--color-text-secondary)]">
                    {item.notes || '-'}
                  </td>
                  {count.status === 'draft' && (
                    <td className="px-6 py-3 text-right">
                      {canCount && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEditItem(item)}
                            className="p-1 text-[var(--color-text-secondary)] hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            type="button"
                            title="Editar"
                          >
                            <PencilIcon size={16} />
                          </button>
                          <button
                            onClick={() => setDeletingItemId(item.ingredientId)}
                            disabled={isRemovingItem}
                            className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            type="button"
                            title="Eliminar"
                          >
                            <XIcon size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>

        {count.items.length === 0 && (
          <div className="p-6 text-center text-[var(--color-text-secondary)]">
            No hay items agregados aún
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="flex flex-col gap-4 sm:flex-row">
        {count.status === 'draft' && count.items.length > 0 && (
          <motion.button
            onClick={handleCompleteCount}
            disabled={isCompleting || !canCount}
            className="rounded-lg bg-amber-600 px-6 py-3 text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isCompleting ? 'Completando...' : 'Completar conteo'}
          </motion.button>
        )}

        {count.status === 'completed' && (
          <div className="flex-1">
            {!canAdjust && (
              <p className="mb-2 text-sm font-medium text-yellow-700">
                No tienes permiso para aplicar ajustes de inventario.
              </p>
            )}
            <motion.button
              onClick={() => setIsConfirmingApply(true)}
              disabled={isApplying || !canAdjust}
              className="rounded-lg bg-[var(--color-success)] px-6 py-3 text-white hover:bg-[var(--color-success)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isApplying ? 'Aplicando...' : 'Aplicar ajustes'}
            </motion.button>
          </div>
        )}

        {count.status === 'applied' && (
          <motion.div
            className="rounded-lg bg-green-50 p-4 text-[var(--color-success)]"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            ✅ Ajustes aplicados correctamente. Los cambios se reflejarán en el inventario.
          </motion.div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {isConfirmingApply && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full rounded-t-lg bg-[var(--color-surface)] p-6 sm:w-auto sm:rounded-lg"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <h3 className="mb-2 text-lg font-semibold">Confirmar aplicación de ajustes</h3>
              <p className="mb-6 text-[var(--color-text-secondary)]">
                Esto aplicará {count.items.filter((i) => i.difference.toString() !== '0').length}{' '}
                ajustes al inventario. ¿Continuar?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsConfirmingApply(false)}
                  disabled={isApplying}
                  className="flex-1 rounded-lg border border-[var(--color-border)] px-4 py-2 text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleApplyAdjustments}
                  disabled={isApplying}
                  className="flex-1 rounded-lg bg-[var(--color-success)] px-4 py-2 text-white hover:bg-[var(--color-success)] disabled:opacity-50 transition-colors"
                >
                  {isApplying ? 'Aplicando...' : 'Confirmar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmar eliminación de item */}
      <AnimatePresence>
        {deletingItemId && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-sm rounded-lg bg-[var(--color-surface)] p-6 shadow-lg"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <h3 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">¿Quitar item del conteo?</h3>
              <p className="mb-6 text-[var(--color-text-secondary)]">
                Se eliminará este ingrediente del conteo. Podrás volver a agregarlo si lo necesitas.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingItemId(null)}
                  disabled={isRemovingItem}
                  className="flex-1 rounded-lg border border-[var(--color-border)] px-4 py-2 text-[var(--color-text-primary)] font-medium hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => deletingItemId && handleConfirmRemoveItem(deletingItemId)}
                  disabled={isRemovingItem}
                  className="flex-1 rounded-lg bg-[var(--color-danger)] px-4 py-2 text-white font-medium hover:bg-[var(--color-danger)] disabled:opacity-50"
                >
                  {isRemovingItem ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmar cancelación del conteo */}
      <AnimatePresence>
        {isConfirmingDeleteCount && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-sm rounded-lg bg-[var(--color-surface)] p-6 shadow-lg"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <h3 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">¿Cancelar este conteo?</h3>
              <p className="mb-6 text-[var(--color-text-secondary)]">
                Esta acción es irreversible. Se eliminará el conteo y todos sus items registrados; el inventario no se ve afectado ya que aún no se aplicó.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsConfirmingDeleteCount(false)}
                  disabled={isDeletingCount}
                  className="flex-1 rounded-lg border border-[var(--color-border)] px-4 py-2 text-[var(--color-text-primary)] font-medium hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
                >
                  Volver
                </button>
                <button
                  onClick={handleDeleteCount}
                  disabled={isDeletingCount}
                  className="flex-1 rounded-lg bg-[var(--color-danger)] px-4 py-2 text-white font-medium hover:bg-[var(--color-danger)] disabled:opacity-50"
                >
                  {isDeletingCount ? 'Eliminando...' : 'Eliminar conteo'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
