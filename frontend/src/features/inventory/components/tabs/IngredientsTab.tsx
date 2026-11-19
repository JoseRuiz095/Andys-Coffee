import { useState } from 'react'
import { sileo } from 'sileo'
import { StatusBadge } from '../../../../shared/components/StatusBadge'
import { PlusIcon } from '../../../../components/ui/PlusIcon'
import { useInventoryList, useSetIngredientActive, useDeleteIngredient } from '../../hooks/useInventory'
import { IngredientFormModal } from '../IngredientFormModal'
import { useCurrentUser } from '../../../auth/hooks/useCurrentUser'
import { useDebouncedValue } from '../../../../shared/hooks/useDebouncedValue'
import { ConfirmDialog } from '../../../../shared/components/ConfirmDialog'
import { getErrorMessage } from '../../../../shared/utils/errors'
import { Pagination } from '../../../../shared/components/Pagination'
import { formatCurrency } from '../../../../shared/utils/formatCurrency'
import { PageHeader } from '../../../../shared/components/PageHeader'
import { FilterBar } from '../../../../shared/components/FilterBar'
import { FILTER_FIELD_CLASS } from '../../../../shared/constants/fieldStyles'
import { QueryErrorState } from '../../../../shared/components/QueryErrorState'
import { TableSkeleton } from '../../../../shared/components/TableSkeleton'
import { RowActions, type RowAction } from '../../../../shared/components/RowActions'

type StatusFilter = 'all' | 'active' | 'inactive'
type StockFilter = 'all' | 'normal' | 'low_stock' | 'out_of_stock'

export function IngredientsTab() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const user = useCurrentUser()
  // One request once the user stops typing, not one per keystroke.
  const debouncedSearch = useDebouncedValue(search, 300)
  const canCreateIngredient = user?.permissions?.includes('inventory.create_ingredient') ?? false
  const canDeleteIngredient = user?.permissions?.includes('inventory.delete_ingredient') ?? false

  const isActiveParam = statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined

  const { data, isLoading, error, refetch, isFetching } = useInventoryList({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    isActive: isActiveParam,
    status: stockFilter !== 'all' ? stockFilter : 'all',
  })

  const { mutate: setActive, isPending: isTogglingActive, variables: togglingVariables } = useSetIngredientActive()
  // Only the row being changed shows it as busy.
  const togglingId = isTogglingActive ? togglingVariables?.id ?? null : null
  // Deactivating is confirmed first.
  const [toDeactivate, setToDeactivate] = useState<{ id: string; name: string } | null>(null)
  const { mutate: deleteIngredient, isPending: isDeleting } = useDeleteIngredient()

  const handleToggleActive = (id: string, currentActive: boolean) => {
    if (isTogglingActive) return
    setActive(
      { id, isActive: !currentActive },
      {
        onSuccess: () => {
          sileo.success({
            title: currentActive ? 'Ingrediente desactivado' : 'Ingrediente activado',
            duration: 2000,
          })
        },
        onError: (error: unknown) => {
          sileo.error({
            title: 'Error',
            description: getErrorMessage(error, 'No se pudo actualizar el ingrediente'),
          })
        },
        onSettled: () => setToDeactivate(null),
      }
    )
  }

  const handleDelete = (id: string) => {
    setDeletingId(id)
  }

  const handleConfirmDelete = (id: string) => {
    deleteIngredient(
      { id },
      {
        onSuccess: () => {
          setDeletingId(null)
          sileo.success({
            title: 'Ingrediente eliminado',
            duration: 2000,
          })
        },
        onError: (error: unknown) => {
          sileo.error({
            title: 'Error',
            description: getErrorMessage(error, 'No se pudo eliminar el ingrediente'),
          })
          setDeletingId(null)
        },
      }
    )
  }

  const handleEditClick = (id: string) => {
    setEditingId(id)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setEditingId(null)
    setIsModalOpen(false)
  }

  // The create/update hooks already refresh the list.
  const handleModalSuccess = () => {
    handleModalClose()
  }


  return (
    <>
      {/* Header */}
      <PageHeader
        title="Ingredientes"
        description="Insumos que se compran y se usan en las recetas."
        actions={
          canCreateIngredient && (
          <button
            onClick={() => {
              setEditingId(null)
              setIsModalOpen(true)
            }}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-[var(--color-button-text)] font-medium flex items-center gap-2 transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            <PlusIcon size={18} />
            Nuevo ingrediente
          </button>
        )
        }
      />

      <FilterBar
        hasFilters={Boolean(search) || statusFilter !== 'active' || stockFilter !== 'all'}
        onClear={() => {
          setSearch('')
          setStatusFilter('active')
          setStockFilter('all')
          setPage(1)
        }}
      >
        <input
          type="search"
          placeholder="Buscar por nombre o SKU..."
          aria-label="Buscar ingrediente por nombre o SKU"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className={`${FILTER_FIELD_CLASS} w-full sm:w-64`}
        />
        <select
          aria-label="Filtrar por estado"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as StatusFilter)
            setPage(1)
          }}
          className={FILTER_FIELD_CLASS}
        >
          <option value="all">Activos e inactivos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
        <select
          aria-label="Filtrar por stock"
          value={stockFilter}
          onChange={(e) => {
            setStockFilter(e.target.value as StockFilter)
            setPage(1)
          }}
          className={FILTER_FIELD_CLASS}
        >
          <option value="all">Cualquier stock</option>
          <option value="normal">Stock normal</option>
          <option value="low_stock">Stock bajo</option>
          <option value="out_of_stock">Sin stock</option>
        </select>
      </FilterBar>

      {error ? (
        <QueryErrorState error={error} subject="los ingredientes" onRetry={() => void refetch()} isRetrying={isFetching} />
      ) : isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : !data?.data?.length ? (
        <p className="rounded-lg border p-8 text-center" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
          {search ? `No encontramos ingredientes que coincidan con "${search}"` : 'No hay ingredientes registrados'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: 'var(--color-surface-hover)', color: 'var(--color-text-primary)' }}>
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">Ingrediente</th>
                <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">Unidad</th>
                <th className="px-4 py-2.5 text-right font-semibold whitespace-nowrap">Mínimo</th>
                <th className="hidden px-4 py-2.5 text-right font-semibold whitespace-nowrap lg:table-cell">Stock actual</th>
                <th className="px-4 py-2.5 text-right font-semibold whitespace-nowrap">Costo prom.</th>
                <th className="px-4 py-2.5 text-center font-semibold whitespace-nowrap">Estado</th>
                <th className="px-4 py-2.5"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody style={{ borderColor: 'var(--color-border)' }} className="divide-y">
              {data.data.map((ingredient) => {
                const actions: RowAction[] = []
                if (canCreateIngredient) {
                  actions.push({ label: 'Editar', ariaLabel: `Editar ${ingredient.name}`, onClick: () => handleEditClick(ingredient.id) })
                  actions.push({
                    label: togglingId === ingredient.id ? 'Cambiando...' : ingredient.isActive ? 'Desactivar' : 'Activar',
                    ariaLabel: `${ingredient.isActive ? 'Desactivar' : 'Activar'} ${ingredient.name}`,
                    onClick: () => (ingredient.isActive ? setToDeactivate({ id: ingredient.id, name: ingredient.name }) : handleToggleActive(ingredient.id, false)),
                    disabled: togglingId !== null,
                  })
                }
                if (canDeleteIngredient) {
                  actions.push({
                    label: 'Eliminar',
                    ariaLabel: `Eliminar ${ingredient.name}`,
                    onClick: () => handleDelete(ingredient.id),
                    disabled: isDeleting || deletingId === ingredient.id,
                    danger: true,
                  })
                }
                return (
                  <tr key={ingredient.id} className="transition-colors hover:bg-[var(--color-surface-hover)]">
                    <td className="px-4 py-2.5">
                      <div className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{ingredient.name}</div>
                      {ingredient.sku && <div className="text-[0.8125rem]" style={{ color: 'var(--color-text-secondary)' }}>{ingredient.sku}</div>}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--color-text-secondary)' }}>{ingredient.unit.abbreviation}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>{Number(ingredient.minimumStock).toFixed(2)}</td>
                    <td className="hidden px-4 py-2.5 text-right tabular-nums whitespace-nowrap lg:table-cell" style={{ color: 'var(--color-text-secondary)' }}>{Number(ingredient.currentStock).toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>{formatCurrency(Number(ingredient.averageCost))}</td>
                    <td className="px-4 py-2.5 text-center">
                      <StatusBadge tone={ingredient.isActive ? 'success' : 'neutral'}>{ingredient.isActive ? 'Activo' : 'Inactivo'}</StatusBadge>
                    </td>
                    <td className="px-4 py-2.5">
                      <RowActions actions={actions} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      {data && data.pagination.totalPages > 1 && (
        <Pagination
          className="mt-4"
          page={page}
          totalPages={data.pagination.totalPages}
          total={data.pagination.total}
          pageSize={data.pagination.limit}
          itemLabel="ingredientes"
          onPageChange={setPage}
        />
      )}

      {/* Modal de Formulario */}
      {isModalOpen && (
      <IngredientFormModal
        key={editingId ?? 'new'}
        isOpen
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        editingIngredientId={editingId}
        showSimilarMatches={false}
      />
      )}

      {/* Modal de Confirmación de Eliminación */}
      <ConfirmDialog
        isOpen={deletingId !== null}
        title="¿Eliminar ingrediente?"
        message="Esta acción es irreversible. El ingrediente será eliminado permanentemente."
        confirmText="Eliminar"
        isDangerous
        isLoading={isDeleting}
        onConfirm={() => deletingId && handleConfirmDelete(deletingId)}
        onCancel={() => setDeletingId(null)}
      />

      <ConfirmDialog
        isOpen={toDeactivate !== null}
        title="Desactivar ingrediente"
        message={`"${toDeactivate?.name ?? ''}" dejará de estar disponible para recetas y nuevas compras. Podrás activarlo de nuevo cuando quieras.`}
        confirmText="Desactivar"
        isDangerous
        isLoading={isTogglingActive}
        onConfirm={() => toDeactivate && handleToggleActive(toDeactivate.id, true)}
        onCancel={() => setToDeactivate(null)}
      />
    </>
  )
}
