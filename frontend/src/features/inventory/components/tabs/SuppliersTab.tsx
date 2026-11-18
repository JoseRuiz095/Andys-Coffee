import { useState } from 'react'
import { sileo } from 'sileo'
import { StatusBadge } from '../../../../shared/components/StatusBadge'
import { PlusIcon } from '../../../../components/ui/PlusIcon'
import { useSuppliersList, useDeleteSupplier, useSetSupplierActive } from '../../hooks/usePurchases'
import { SupplierFormModal } from '../SupplierFormModal'
import { useCurrentUser } from '../../../auth/hooks/useCurrentUser'
import { useDebouncedValue } from '../../../../shared/hooks/useDebouncedValue'
import { ConfirmDialog } from '../../../../shared/components/ConfirmDialog'
import { getErrorMessage } from '../../../../shared/utils/errors'
import { Pagination } from '../../../../shared/components/Pagination'
import { PageHeader } from '../../../../shared/components/PageHeader'
import { FilterBar } from '../../../../shared/components/FilterBar'
import { FILTER_FIELD_CLASS } from '../../../../shared/constants/fieldStyles'
import { QueryErrorState } from '../../../../shared/components/QueryErrorState'
import { TableSkeleton } from '../../../../shared/components/TableSkeleton'
import { RowActions, type RowAction } from '../../../../shared/components/RowActions'

type StatusFilter = 'all' | 'active' | 'inactive'

export function SuppliersTab() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const user = useCurrentUser()
  // One request once the user stops typing, not one per keystroke.
  const debouncedSearch = useDebouncedValue(search, 300)
  const canCreateSupplier = user?.permissions?.includes('inventory.manage_suppliers') ?? false
  const canDeleteSupplier = user?.permissions?.includes('inventory.delete_supplier') ?? false

  const isActiveParam = statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined

  const { data, isLoading, error, refetch, isFetching } = useSuppliersList({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    isActive: isActiveParam,
  })

  const { mutate: setActive, isPending: isTogglingActive, variables: togglingVariables } = useSetSupplierActive()
  // Only the row being changed shows it as busy.
  const togglingId = isTogglingActive ? togglingVariables?.id ?? null : null
  // Deactivating is confirmed first.
  const [toDeactivate, setToDeactivate] = useState<{ id: string; name: string } | null>(null)
  const { mutate: deleteSupplier, isPending: isDeleting } = useDeleteSupplier()

  const handleToggleActive = (id: string, currentActive: boolean) => {
    if (isTogglingActive) return
    setActive(
      { id, isActive: !currentActive },
      {
        onSuccess: () => {
          sileo.success({
            title: currentActive ? 'Proveedor desactivado' : 'Proveedor activado',
            duration: 2000,
          })
        },
        onError: (error: unknown) => {
          sileo.error({
            title: 'Error',
            description: getErrorMessage(error, 'No se pudo actualizar el proveedor'),
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
    deleteSupplier(
      { id },
      {
        onSuccess: () => {
          setDeletingId(null)
          sileo.success({
            title: 'Proveedor eliminado',
            duration: 2000,
          })
        },
        onError: (error: unknown) => {
          sileo.error({
            title: 'Error',
            description: getErrorMessage(error, 'No se pudo eliminar el proveedor'),
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
        title="Proveedores"
        description="A quién le compras los insumos."
        actions={
          canCreateSupplier && (
          <button
            onClick={() => {
              setEditingId(null)
              setIsModalOpen(true)
            }}
            className="rounded-lg px-4 py-2 font-medium flex items-center gap-2 transition-colors"
            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-button-text)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary)'
            }}
          >
            <PlusIcon size={18} />
            Nuevo proveedor
          </button>
        )
        }
      />

      <FilterBar
        hasFilters={Boolean(search) || statusFilter !== 'active'}
        onClear={() => {
          setSearch('')
          setStatusFilter('active')
          setPage(1)
        }}
      >
        <input
          type="search"
          placeholder="Buscar por nombre, email o teléfono..."
          aria-label="Buscar proveedor"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className={`${FILTER_FIELD_CLASS} w-full sm:w-72`}
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
      </FilterBar>

      {error ? (
        <QueryErrorState error={error} subject="los proveedores" onRetry={() => void refetch()} isRetrying={isFetching} />
      ) : isLoading ? (
        <TableSkeleton rows={5} columns={5} />
      ) : !data?.data?.length ? (
        <p className="rounded-lg border p-8 text-center" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
          {search ? `No encontramos proveedores que coincidan con "${search}"` : 'No hay proveedores registrados'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Proveedor</th>
                <th className="px-4 py-3 text-left font-semibold">Email</th>
                <th className="px-4 py-3 text-left font-semibold">Teléfono</th>
                <th className="px-4 py-3 text-center font-semibold">Estado</th>
                <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {data.data.map((supplier) => {
                const actions: RowAction[] = []
                if (canCreateSupplier) {
                  actions.push({ label: 'Editar', ariaLabel: `Editar ${supplier.name}`, onClick: () => handleEditClick(supplier.id) })
                  actions.push({
                    label: togglingId === supplier.id ? 'Cambiando...' : supplier.isActive ? 'Desactivar' : 'Activar',
                    ariaLabel: `${supplier.isActive ? 'Desactivar' : 'Activar'} ${supplier.name}`,
                    onClick: () => (supplier.isActive ? setToDeactivate({ id: supplier.id, name: supplier.name }) : handleToggleActive(supplier.id, false)),
                    disabled: togglingId !== null,
                  })
                }
                if (canDeleteSupplier) {
                  actions.push({
                    label: 'Eliminar',
                    ariaLabel: `Eliminar ${supplier.name}`,
                    onClick: () => handleDelete(supplier.id),
                    disabled: isDeleting || deletingId === supplier.id,
                    danger: true,
                  })
                }
                return (
                  <tr key={supplier.id} className="hover:bg-[var(--color-surface-hover)]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--color-text-primary)]">{supplier.name}</div>
                      {/* The address is kept, below the name, instead of a wide column. */}
                      {supplier.address && <div className="text-xs text-[var(--color-text-secondary)]">{supplier.address}</div>}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{supplier.email || '—'}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{supplier.phone || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge tone={supplier.isActive ? 'success' : 'neutral'}>{supplier.isActive ? 'Activo' : 'Inactivo'}</StatusBadge>
                    </td>
                    <td className="px-4 py-3">
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
          itemLabel="proveedores"
          onPageChange={setPage}
        />
      )}

      {/* Modal de Formulario */}
      {isModalOpen && (
      <SupplierFormModal
        key={editingId ?? 'new'}
        isOpen
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        editingSupplierId={editingId}
        showSimilarMatches={false}
      />
      )}

      {/* Modal de Confirmación de Eliminación */}
      <ConfirmDialog
        isOpen={deletingId !== null}
        title="¿Eliminar proveedor?"
        message="Esta acción es irreversible. El proveedor será eliminado permanentemente."
        confirmText="Eliminar"
        isDangerous
        isLoading={isDeleting}
        onConfirm={() => deletingId && handleConfirmDelete(deletingId)}
        onCancel={() => setDeletingId(null)}
      />

      <ConfirmDialog
        isOpen={toDeactivate !== null}
        title="Desactivar proveedor"
        message={`"${toDeactivate?.name ?? ''}" dejará de aparecer al registrar compras. Podrás activarlo de nuevo cuando quieras.`}
        confirmText="Desactivar"
        isDangerous
        isLoading={isTogglingActive}
        onConfirm={() => toDeactivate && handleToggleActive(toDeactivate.id, true)}
        onCancel={() => setToDeactivate(null)}
      />
    </>
  )
}
