import { useState, useEffect } from 'react'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { sileo } from 'sileo'
import { Skeleton } from '../../../shared/components/Skeleton'
import { PencilIcon } from '../../../components/ui/PencilIcon'
import { XIcon } from '../../../components/ui/XIcon'
import { formatDate, getTodayDateString } from '../../../shared/utils/dateUtils'
import { FILTER_FIELD_CLASS, FORM_CONTROL_CLASS, FORM_FIELD_CLASS, FORM_LABEL_CLASS } from '../../../shared/constants/fieldStyles'
import { ACTION_DANGER_CLASS, ACTION_LINK_CLASS, ACTION_PRIMARY_CLASS, ACTION_SECONDARY_CLASS, ACTION_SUCCESS_CLASS } from '../../../shared/constants/actionStyles'
import { CELL_SECONDARY_CLASS, NUMERIC_CLASS, TABLE_CARD_CLASS, TABLE_CLASS, TABLE_HEAD_CLASS, TD_CLASS, TH_CLASS, TR_CLASS } from '../../../shared/constants/tableStyles'
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
    const hasCountFilters = countsStatusFilter !== 'all' || Boolean(countsDateFilter)
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Conteos físicos"
          description="Cuenta el inventario real y aplica las diferencias al stock."
          actions={
            canCount && (
              <span className="text-sm">
                <button type="button" onClick={handleCreateCount} disabled={isCreating} className={ACTION_PRIMARY_CLASS}>
                  {isCreating ? 'Creando...' : 'Crear nuevo conteo'}
                </button>
              </span>
            )
          }
        />

        {!canCount && <PermissionNotice action="crear o editar conteos físicos" />}

        <section aria-labelledby="counts-recent-title" className={TABLE_CARD_CLASS}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
            <h2 id="counts-recent-title" className="text-base font-semibold text-[var(--color-text-primary)]">Conteos recientes</h2>

            {/* Filtros */}
            <div role="search" className="flex flex-wrap items-center gap-2">
              <select
                id="inv-physical-estado"
                aria-label="Estado del conteo"
                value={countsStatusFilter}
                onChange={(e) => {
                  setCountsStatusFilter(e.target.value)
                  setCountsPage(1)
                }}
                className={FILTER_FIELD_CLASS}
              >
                <option value="all">Todos los estados</option>
                <option value="draft">Borrador</option>
                <option value="completed">Completado</option>
                <option value="applied">Aplicado</option>
              </select>
              <input
                id="inv-physical-fecha"
                type="date"
                aria-label="Fecha del conteo"
                value={countsDateFilter}
                onChange={(e) => {
                  setCountsDateFilter(e.target.value)
                  setCountsPage(1)
                }}
                className={FILTER_FIELD_CLASS}
              />
              {hasCountFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setCountsDateFilter('')
                    setCountsStatusFilter('all')
                    setCountsPage(1)
                  }}
                  className={`${ACTION_LINK_CLASS} px-2 text-sm`}
                >
                  Ver todo el historial
                </button>
              )}
            </div>
          </div>

          {/* Lista */}
          {isLoadingRecent ? (
            <div className="space-y-2 p-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : !recentCounts?.data.length ? (
            <p className="px-4 py-6 text-center text-sm text-[var(--color-text-secondary)]">
              {hasCountFilters ? 'No hay conteos con estos filtros.' : 'No hay conteos registrados aún.'}
            </p>
          ) : (
            <>
              <ul className="divide-y divide-[var(--color-border)]">
                {recentCounts.data.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => setCountId(c.id)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--color-surface-hover)]"
                      type="button"
                    >
                      <span className="min-w-0">
                        <span className="block font-medium text-[var(--color-text-primary)]">Conteo #{c.id.slice(0, 8)}</span>
                        <span className="block text-sm text-[var(--color-text-secondary)]">
                          {c.createdBy.name} · {formatDate(c.createdAt)} · {c.items.length} item(s)
                        </span>
                      </span>
                      {getStatusBadge(c.status)}
                    </button>
                  </li>
                ))}
              </ul>

              {/* Paginación */}
              {recentCounts.pagination.totalPages > 1 && (
                <Pagination
                  className="border-t border-[var(--color-border)] px-4 py-3"
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
        </section>
      </div>
    )
  }

  if (isLoadingCount) {
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!count) {
    // E.g. the count was deleted from another device: drop the remembered id and go back.
    return (
      <div className="mx-auto max-w-7xl space-y-3">
        <p className="text-[var(--color-danger)]">Conteo no encontrado. Puede que se haya eliminado desde otro dispositivo.</p>
        <span className="text-sm">
          <button type="button" onClick={() => setCountId(null)} className={ACTION_SECONDARY_CLASS}>
            Volver a los conteos
          </button>
        </span>
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
    <div className="mx-auto max-w-7xl">
      <button type="button" onClick={() => setCountId(null)} className={`${ACTION_LINK_CLASS} mb-1 text-sm`}>
        ← Volver a los conteos
      </button>
      {/* The count's next step (complete / apply) sits in the header, next to its status. */}
      <PageHeader
        title={`Conteo #${count.id.slice(0, 8)}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            {getStatusBadge(count.status)}
            <span>
              Creado por {count.createdBy.name} · {count.items.length} item(s) contados · {adjustmentCount} diferencia(s) ·{' '}
              {formatDate(count.createdAt)}
            </span>
          </span>
        }
        actions={
          <span className="flex flex-wrap items-center gap-2 text-sm">
            {count.status === 'draft' && canCount && (
              <button type="button" onClick={() => setIsConfirmingDeleteCount(true)} className={ACTION_DANGER_CLASS}>
                Cancelar conteo
              </button>
            )}
            {count.status === 'draft' && count.items.length > 0 && canCount && (
              <button type="button" onClick={() => setIsConfirmingComplete(true)} disabled={isCompleting} className={ACTION_PRIMARY_CLASS}>
                {isCompleting ? 'Completando...' : 'Completar conteo'}
              </button>
            )}
            {count.status === 'completed' && canAdjust && (
              <button type="button" onClick={() => setIsConfirmingApply(true)} disabled={isApplying} className={ACTION_SUCCESS_CLASS}>
                {isApplying ? 'Aplicando...' : 'Aplicar ajustes'}
              </button>
            )}
          </span>
        }
      />

      {count.status === 'completed' && !canAdjust && <PermissionNotice action="aplicar ajustes de inventario" />}

      {count.status === 'applied' && (
        <p
          role="status"
          className="mb-4 rounded-lg border px-4 py-3 text-sm font-medium text-[var(--color-success)]"
          style={{
            borderColor: 'color-mix(in srgb, var(--color-success) 35%, var(--color-border))',
            backgroundColor: 'color-mix(in srgb, var(--color-success) 8%, var(--color-surface))',
          }}
        >
          Ajustes aplicados correctamente. Los cambios se reflejarán en el inventario.
        </p>
      )}

      {/* Agregar items (si está en draft): fields and action in one row on wide screens. */}
      {count.status === 'draft' && canCount && (
        <section
          aria-labelledby="count-add-title"
          className="mb-4 rounded-lg border bg-[var(--color-surface)] p-4"
          style={{ borderColor: isEditingExisting ? 'var(--color-info)' : 'var(--color-border)' }}
        >
          <h2 id="count-add-title" className="mb-3 text-base font-semibold text-[var(--color-text-primary)]">
            {isEditingExisting ? 'Actualizar ingrediente' : 'Agregar ingrediente'}
          </h2>

          {isEditingExisting && (
            <p className="mb-3 rounded-lg bg-[color-mix(in_srgb,var(--color-info)_10%,var(--color-surface))] px-3 py-2 text-sm text-[var(--color-text-primary)]">
              Este ingrediente ya está en el conteo — al guardar se actualizará su registro.
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)_auto]">
            <div className="relative">
              <label htmlFor="inv-physical-ingrediente" className={FORM_LABEL_CLASS}>
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
                  className={`${FORM_FIELD_CLASS} pr-10`}
                />
                {selectedIngredientId && (
                  <button
                    aria-label="Quitar ingrediente seleccionado"
                    title="Quitar ingrediente"
                    onClick={() => {
                      setSelectedIngredientId('')
                      setSelectedIngredientData(null)
                      setIngredientSearch('')
                    }}
                    className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                    type="button"
                  >
                    <XIcon size={16} />
                  </button>
                )}
              </div>

              {showIngredientResults && !selectedIngredientId && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg">
                  {filteredIngredients.length > 0 ? (
                    <div className="divide-y divide-[var(--color-border)]">
                      {filteredIngredients.map((ing) => (
                        <button
                          key={ing.id}
                          onClick={() => handleSelectIngredient(ing)}
                          className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--color-surface-hover)]"
                          type="button"
                        >
                          <span className="min-w-0 text-sm font-medium text-[var(--color-text-primary)]">
                            {ing.name}
                            {ing.sku && <span className="ml-1 font-normal text-[var(--color-text-secondary)]">({ing.sku})</span>}
                            {countedIngredientIds.has(ing.id) && (
                              <span className="ml-1 font-normal text-[var(--color-info)]">· ya contado</span>
                            )}
                          </span>
                          <span className="shrink-0 text-sm tabular-nums text-[var(--color-text-secondary)]">
                            Stock: {Number(ing.currentStock).toFixed(2)} {ing.unit?.abbreviation}
                          </span>
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
              <label htmlFor="inv-physical-cantidad-contada" className={FORM_LABEL_CLASS}>
                Cantidad Contada
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="inv-physical-cantidad-contada"
                  type="number"
                  step="0.01"
                  min="0"
                  value={countedQty}
                  onChange={(e) => setCountedQty(e.target.value)}
                  placeholder="0.00"
                  className={`${FORM_CONTROL_CLASS} w-0 min-w-0 flex-1 tabular-nums`}
                />
                {selectedIngredientData?.unit && (
                  <span className="shrink-0 text-sm text-[var(--color-text-secondary)]">{selectedIngredientData.unit.abbreviation}</span>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="inv-physical-notas-opcional" className={FORM_LABEL_CLASS}>
                Notas <span className="font-normal text-[var(--color-text-secondary)]">(opcional) · {notes.length}/500</span>
              </label>
              <input
                id="inv-physical-notas-opcional"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: dañado, encontrado en bodega..."
                maxLength={500}
                className={FORM_FIELD_CLASS}
              />
            </div>

            <div className="flex flex-wrap gap-2 text-sm md:pt-6">
              <button
                onClick={handleAddItem}
                disabled={!selectedIngredientId || !countedQty || isAddingItem}
                className={ACTION_PRIMARY_CLASS}
                type="button"
              >
                {isAddingItem ? 'Guardando...' : isEditingExisting ? 'Actualizar item' : 'Agregar item'}
              </button>
              {isEditingExisting && (
                <button onClick={resetItemForm} type="button" className={ACTION_SECONDARY_CLASS}>
                  Cancelar edición
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Tabla de items */}
      <section aria-label="Ingredientes contados" className={TABLE_CARD_CLASS}>
        <div className="overflow-x-auto">
          <table className={TABLE_CLASS}>
            <thead className={TABLE_HEAD_CLASS}>
              <tr>
                <th className={`${TH_CLASS} text-left`}>Ingrediente</th>
                <th className={`${TH_CLASS} text-right`}>Sistema</th>
                <th className={`${TH_CLASS} text-right`}>Contado</th>
                <th className={`${TH_CLASS} text-right`}>Diferencia</th>
                <th className={`${TH_CLASS} text-left`}>Notas</th>
                {count.status === 'draft' && (
                  <th className={`${TH_CLASS} text-right`}>Acciones</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {count.items.map((item) => {
                const unit = item.ingredient?.unit?.abbreviation
                return (
                  <tr key={item.ingredientId} className={TR_CLASS}>
                    <td className={TD_CLASS}>
                      <div className="font-medium text-[var(--color-text-primary)]">{item.ingredient?.name}</div>
                      {item.ingredient?.sku && <div className={CELL_SECONDARY_CLASS}>{item.ingredient.sku}</div>}
                    </td>
                    <td className={`${TD_CLASS} ${NUMERIC_CLASS} text-[var(--color-text-secondary)]`}>
                      {Number(item.systemQuantity).toFixed(2)} {unit}
                    </td>
                    <td className={`${TD_CLASS} ${NUMERIC_CLASS} font-medium text-[var(--color-text-primary)]`}>
                      {Number(item.countedQuantity).toFixed(2)} {unit}
                    </td>
                    <td className={`${TD_CLASS} ${NUMERIC_CLASS} ${getDifferenceColor(parseFloat(item.difference.toString()))}`}>
                      {parseFloat(item.difference.toString()) > 0 ? '+' : ''}
                      {Number(item.difference).toFixed(2)} {unit}
                    </td>
                    <td className={`${TD_CLASS} text-[var(--color-text-secondary)]`}>
                      {item.notes || '-'}
                    </td>
                    {count.status === 'draft' && (
                      <td className={`${TD_CLASS} text-right`}>
                        {canCount && (
                          <div className="-my-1 flex justify-end gap-1">
                            <button
                              onClick={() => handleEditItem(item)}
                              className="grid size-9 place-items-center rounded text-[var(--color-text-secondary)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-info)_10%,var(--color-surface))] hover:text-[var(--color-info)]"
                              type="button"
                              title="Editar"
                              aria-label="Editar"
                            >
                              <PencilIcon size={16} />
                            </button>
                            <button
                              onClick={() => setDeletingItemId(item.ingredientId)}
                              disabled={isRemovingItem}
                              className="grid size-9 place-items-center rounded text-[var(--color-text-secondary)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,var(--color-surface))] hover:text-[var(--color-danger)] disabled:opacity-50"
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
                )
              })}
            </tbody>
          </table>
        </div>

        {count.items.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-[var(--color-text-secondary)]">
            No hay items agregados aún. Busca un ingrediente arriba y registra la cantidad contada.
          </p>
        )}
      </section>

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
