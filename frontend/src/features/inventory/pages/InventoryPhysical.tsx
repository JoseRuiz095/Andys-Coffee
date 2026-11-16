import { useState, useEffect } from 'react'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { sileo } from 'sileo'
import { Skeleton } from '../../../shared/components/Skeleton'
import { PencilIcon } from '../../../components/ui/PencilIcon'
import { XIcon } from '../../../components/ui/XIcon'
import { getTodayDateString } from '../../../shared/utils/dateUtils'
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
import { getErrorMessage } from '../../../shared/utils/errors'
import { Pagination } from '../../../shared/components/Pagination'
import { useCurrentUser } from '../../auth/hooks/useCurrentUser'
import { StatusBadge } from '../../../shared/components/StatusBadge'
import { PermissionNotice } from '../../../shared/components/PermissionNotice'
import { PageHeader } from '../../../shared/components/PageHeader'

const ACTIVE_COUNT_STORAGE_KEY = 'activeInventoryCountId'

function readStoredCountId(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_COUNT_STORAGE_KEY)
  } catch {
    return null
  }
}

export function InventoryPhysical() {
  const user = useCurrentUser()
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
  // Completing freezes the count: it is confirmed first.
  const [isConfirmingComplete, setIsConfirmingComplete] = useState(false)
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)
  const [isConfirmingDeleteCount, setIsConfirmingDeleteCount] = useState(false)
  const [countsPage, setCountsPage] = useState(1)
  const [countsStatusFilter, setCountsStatusFilter] = useState('all')
  const [countsDateFilter, setCountsDateFilter] = useState(getTodayDateString())

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
          description: getErrorMessage(error, 'Inténtalo de nuevo.'),
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
    if (!selectedIngredientId || !countedQty.trim()) {
      sileo.error({
        title: 'Campos requeridos',
        description: 'Selecciona un ingrediente y cantidad.',
      })
      return
    }

    // `min="0"` is only a browser hint: a counted quantity can be 0 but never negative.
    const counted = Number(countedQty)
    if (!Number.isFinite(counted) || counted < 0) {
      sileo.error({
        title: 'Cantidad inválida',
        description: 'La cantidad contada debe ser un número mayor o igual a 0.',
      })
      return
    }

    const isUpdating = count?.items.some((i) => i.ingredientId === selectedIngredientId) ?? false

    addItem(
      {
        ingredientId: selectedIngredientId,
        countedQuantity: counted,
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
            description: getErrorMessage(error, 'Inténtalo de nuevo.'),
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
          description: getErrorMessage(error, 'Inténtalo de nuevo.'),
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
          description: getErrorMessage(error, 'Inténtalo de nuevo.'),
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
        setIsConfirmingComplete(false)
        sileo.success({ title: 'Conteo completado correctamente.', duration: 3000 })
      },
      onError: (error) => {
        sileo.error({
          title: 'No se pudo completar el conteo',
          description: getErrorMessage(error, 'Inténtalo de nuevo.'),
        })
      },
    })
  }

  const handleApplyAdjustments = () => {
    if (!count) return
    const adjustmentCount = count.items.filter((i) => Number(i.difference) !== 0).length
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
          description: getErrorMessage(error, 'Inténtalo de nuevo.'),
        })
      },
    })
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; tone: 'info' | 'warning' | 'success' }> = {
      draft: { label: 'Borrador', tone: 'info' },
      completed: { label: 'Completado', tone: 'warning' },
      applied: { label: 'Aplicado', tone: 'success' },
    };
    const badge = badges[status];
    return <StatusBadge tone={badge?.tone ?? 'neutral'}>{badge?.label ?? status}</StatusBadge>;
  };

  const getDifferenceColor = (diff: number) => {
    if (diff > 0) return 'text-[var(--color-success)] font-semibold';
    if (diff < 0) return 'text-[var(--color-danger)] font-semibold';
    return 'text-[var(--color-text-secondary)]';
  };

  if (!countId) {
    return (
      <div
        className="p-6"
      >
        <PageHeader title="Conteos físicos" description="Cuenta el inventario real y aplica las diferencias al stock." />

        {!canCount && <PermissionNotice action="crear o editar conteos físicos" />}

        {canCount && (
        <div className="rounded-lg bg-[var(--color-surface)] p-6 text-center shadow">
          <p className="mb-6 text-[var(--color-text-secondary)]">
            Crear un nuevo conteo físico para reconciliar el inventario del sistema con el real
          </p>
          <button
            onClick={handleCreateCount}
            disabled={isCreating}
            className="rounded-lg bg-[var(--color-primary)] px-6 py-3 text-[var(--color-button-text)] hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {isCreating ? 'Creando...' : 'Crear nuevo conteo'}
          </button>
        </div>
        )}

        <div className="mt-6 rounded-lg bg-[var(--color-surface)] p-6 shadow">
          <h2 className="mb-4 text-lg font-bold">Conteos recientes</h2>

          {/* Filtros */}
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="inv-physical-estado" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Estado</label>
              <select
                id="inv-physical-estado"
                value={countsStatusFilter}
                onChange={(e) => {
                  setCountsStatusFilter(e.target.value)
                  setCountsPage(1)
                }}
                className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 bg-[var(--color-input-bg)] text-[var(--color-input-text)]"
              >
                <option value="all">Todos</option>
                <option value="draft">Borrador</option>
                <option value="completed">Completado</option>
                <option value="applied">Aplicado</option>
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label htmlFor="inv-physical-fecha" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Fecha</label>
              <input
                id="inv-physical-fecha"
                type="date"
                value={countsDateFilter}
                onChange={(e) => {
                  setCountsDateFilter(e.target.value)
                  setCountsPage(1)
                }}
                className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 bg-[var(--color-input-bg)] text-[var(--color-input-text)]"
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
              <div className="mb-4 divide-y divide-[var(--color-border)]">
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
                        {c.createdBy.name} · {new Date(c.createdAt).toLocaleDateString('es-MX')} ·{' '}
                        {c.items.length} item(s)
                      </p>
                    </div>
                    {getStatusBadge(c.status)}
                  </button>
                ))}
              </div>

              {/* Paginación */}
              {recentCounts.pagination.totalPages > 1 && (
                <Pagination
                  className="border-t border-[var(--color-border)] pt-4"
                  page={countsPage}
                  totalPages={recentCounts.pagination.totalPages}
                  total={recentCounts.pagination.total}
                  pageSize={recentCounts.pagination.limit}
                  itemLabel="conteos"
                  onPageChange={setCountsPage}
                />
              )}
            </>
          )}
        </div>
      </div>
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
    // E.g. the count was deleted from another device: drop the remembered id and go back.
    return (
      <div className="space-y-3 p-6">
        <p className="text-[var(--color-danger)]">Conteo no encontrado. Puede que se haya eliminado desde otro dispositivo.</p>
        <button
          type="button"
          onClick={() => setCountId(null)}
          className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
        >
          Volver a los conteos
        </button>
      </div>
    )
  }

  const adjustmentCount = count.items.filter((i) => Number(i.difference) !== 0).length
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
    <div
      className="p-6"
    >
      <button
        type="button"
        onClick={() => setCountId(null)}
        className="mb-3 text-sm font-medium hover:underline"
        style={{ color: 'var(--color-primary)' }}
      >
        ← Volver a los conteos
      </button>
      <PageHeader
        title={`Conteo #${count.id.slice(0, 8)}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            {getStatusBadge(count.status)}
            <span>
              Creado por {count.createdBy.name} · {count.items.length} item(s) contados · {adjustmentCount} diferencia(s) ·{' '}
              {new Date(count.createdAt).toLocaleDateString('es-MX')}
            </span>
          </span>
        }
        actions={
          count.status === 'draft' &&
          canCount && (
            <button
              type="button"
              onClick={() => setIsConfirmingDeleteCount(true)}
              className="min-h-10 rounded-lg border border-[color-mix(in_srgb,var(--color-danger)_35%,var(--color-border))] px-4 text-sm text-[var(--color-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,var(--color-surface))]"
            >
              Cancelar conteo
            </button>
          )
        }
      />

      {/* Agregar items (si está en draft) */}
              {count.status === 'draft' && canCount && (
          <div
            className="mb-6 rounded-lg bg-[var(--color-surface)] p-6 shadow"
          >
            <h2 className="mb-4 text-lg font-bold">Agregar Ingrediente</h2>

            {isEditingExisting && (
              <div className="mb-4 rounded-lg bg-[color-mix(in_srgb,var(--color-info)_10%,var(--color-surface))] p-3 text-sm text-[var(--color-text-primary)]">
                Este ingrediente ya está en el conteo — al guardar se actualizará su registro.
              </div>
            )}

            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="relative">
                <label htmlFor="inv-physical-ingrediente" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
                  Ingrediente
                </label>
                <div className="relative">
                  <input
                    id="inv-physical-ingrediente"
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
                    className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 transition-colors focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 bg-[var(--color-input-bg)] text-[var(--color-input-text)]"
                  />
                  {selectedIngredientId && (
                    <button
                      aria-label="Quitar ingrediente seleccionado"
                      onClick={() => {
                        setSelectedIngredientId('')
                        setSelectedIngredientData(null)
                        setIngredientSearch('')
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]"
                      type="button"
                    >
                      ✕
                    </button>
                  )}
                </div>

                                  {showIngredientResults && !selectedIngredientId && (
                    <div
                      className="absolute top-full left-0 right-0 z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg"
                    >
                      {filteredIngredients.length > 0 ? (
                        <div className="divide-y divide-[var(--color-border)]">
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
                                  <span className="ml-1 text-xs font-normal text-[var(--color-info)]">· ya contado</span>
                                )}
                              </p>
                              <p className="text-sm text-[var(--color-text-secondary)]">
                                Stock: {Number(ing.currentStock).toFixed(2)} {ing.unit?.abbreviation}
                              </p>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 text-center text-sm text-[var(--color-text-secondary)]">No encontramos ingredientes</div>
                      )}
                    </div>
                  )}
                              </div>

              <div>
                <label htmlFor="inv-physical-cantidad-contada" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
                  Cantidad Contada
                </label>
                <input
                  id="inv-physical-cantidad-contada"
                  type="number"
                  step="0.01"
                  min="0"
                  value={countedQty}
                  onChange={(e) => setCountedQty(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 transition-colors focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 bg-[var(--color-input-bg)] text-[var(--color-input-text)]"
                />
              </div>

              <div>
                <label htmlFor="inv-physical-notas-opcional" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
                  Notas (opcional)
                </label>
                <input
                  id="inv-physical-notas-opcional"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: dañado, encontrado en bodega..."
                  maxLength={500}
                  className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 transition-colors focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 bg-[var(--color-input-bg)] text-[var(--color-input-text)]"
                />
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{notes.length}/500</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAddItem}
                disabled={!selectedIngredientId || !countedQty || isAddingItem}
                className="rounded-lg bg-[var(--color-primary)] px-6 py-2 text-[var(--color-button-text)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
              >
                {isAddingItem ? 'Guardando...' : isEditingExisting ? 'Actualizar item' : 'Agregar item'}
              </button>
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
          </div>
        )}
      
      {/* Tabla de items */}
      <div className="mb-6 overflow-x-auto rounded-lg bg-[var(--color-surface)] shadow">
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
          <tbody className="divide-y divide-[var(--color-border)]">
                          {count.items.map((item) => (
                <tr
                  key={item.ingredientId}
                  className="hover:bg-[var(--color-surface-hover)] transition-colors"
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
                            className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-info)] hover:bg-[color-mix(in_srgb,var(--color-info)_10%,var(--color-surface))] rounded transition-colors"
                            type="button"
                            title="Editar"
                            aria-label="Editar"
                          >
                            <PencilIcon size={16} />
                          </button>
                          <button
                            onClick={() => setDeletingItemId(item.ingredientId)}
                            disabled={isRemovingItem}
                            className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,var(--color-surface))] rounded transition-colors disabled:opacity-50"
                            type="button"
                            title="Eliminar"
                            aria-label="Eliminar"
                          >
                            <XIcon size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
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
        {count.status === 'draft' && count.items.length > 0 && canCount && (
          <button
            onClick={() => setIsConfirmingComplete(true)}
            disabled={isCompleting}
            className="rounded-lg bg-[var(--color-warning)] px-6 py-3 text-[var(--color-button-text)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {isCompleting ? 'Completando...' : 'Completar conteo'}
          </button>
        )}

        {count.status === 'completed' && (
          <div className="flex-1">
            {!canAdjust ? (
              <PermissionNotice action="aplicar ajustes de inventario" />
            ) : (
            <button
              onClick={() => setIsConfirmingApply(true)}
              disabled={isApplying}
              className="rounded-lg bg-[var(--color-success)] px-6 py-3 text-[var(--color-button-text)] hover:bg-[var(--color-success-hover)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              {isApplying ? 'Aplicando...' : 'Aplicar ajustes'}
            </button>
            )}
          </div>
        )}

        {count.status === 'applied' && (
          <div
            className="rounded-lg bg-[color-mix(in_srgb,var(--color-success)_10%,var(--color-surface))] p-4 text-[var(--color-success)]"
          >
            Ajustes aplicados correctamente. Los cambios se reflejarán en el inventario.
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={isConfirmingComplete}
        title="¿Completar el conteo?"
        message="Ya no podrás agregar ni modificar items. Después podrás aplicar los ajustes al inventario."
        confirmText="Completar conteo"
        isLoading={isCompleting}
        onConfirm={handleCompleteCount}
        onCancel={() => setIsConfirmingComplete(false)}
      />

      <ConfirmDialog
        isOpen={isConfirmingApply}
        title="Confirmar aplicación de ajustes"
        message={`Esto aplicará ${adjustmentCount} ajustes al inventario. ¿Continuar?`}
        confirmText="Confirmar"
        isLoading={isApplying}
        onConfirm={handleApplyAdjustments}
        onCancel={() => setIsConfirmingApply(false)}
      />

      <ConfirmDialog
        isOpen={Boolean(deletingItemId)}
        title="¿Quitar item del conteo?"
        message="Se eliminará este ingrediente del conteo. Podrás volver a agregarlo si lo necesitas."
        confirmText="Eliminar"
        isDangerous
        isLoading={isRemovingItem}
        onConfirm={() => deletingItemId && handleConfirmRemoveItem(deletingItemId)}
        onCancel={() => setDeletingItemId(null)}
      />

      <ConfirmDialog
        isOpen={isConfirmingDeleteCount}
        title="¿Cancelar este conteo?"
        message="Esta acción es irreversible. Se eliminará el conteo y todos sus items registrados; el inventario no se ve afectado ya que aún no se aplicó."
        confirmText="Eliminar conteo"
        cancelText="Volver"
        isDangerous
        isLoading={isDeletingCount}
        onConfirm={handleDeleteCount}
        onCancel={() => setIsConfirmingDeleteCount(false)}
      />
    </div>
  )
}
