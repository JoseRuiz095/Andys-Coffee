import { useState } from 'react'
import { motion } from 'framer-motion'
import { sileo } from 'sileo'
import { Skeleton } from '../../../../shared/components/Skeleton'
import { PencilIcon } from '../../../../components/ui/PencilIcon'
import { XIcon } from '../../../../components/ui/XIcon'
import { PlusIcon } from '../../../../components/ui/PlusIcon'
import { useSuppliersList, useDeleteSupplier, useSetSupplierActive } from '../../hooks/usePurchases'
import { SupplierFormModal } from '../SupplierFormModal'
import { authStore } from '../../../../features/auth/store/auth.store'

type StatusFilter = 'all' | 'active' | 'inactive'

export function SuppliersTab() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const user = authStore.getState().user
  const canCreateSupplier = user?.permissions?.includes('inventory.manage_suppliers') ?? false
  const canDeleteSupplier = user?.permissions?.includes('inventory.delete_supplier') ?? false

  const isActiveParam = statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined

  const { data, isLoading, error, refetch } = useSuppliersList({
    page,
    limit: 20,
    search: search || undefined,
    isActive: isActiveParam,
  })

  const { mutate: setActive, isPending: isTogglingActive } = useSetSupplierActive()
  const { mutate: deleteSupplier, isPending: isDeleting } = useDeleteSupplier()

  const handleToggleActive = (id: string, currentActive: boolean) => {
    setActive(
      { id, isActive: !currentActive },
      {
        onSuccess: () => {
          refetch()
          sileo.success({
            title: currentActive ? 'Proveedor desactivado' : 'Proveedor activado',
            duration: 2000,
          })
        },
        onError: (error: any) => {
          sileo.error({
            title: 'Error',
            description: error?.response?.data?.message || 'No se pudo actualizar el proveedor',
          })
        },
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
          refetch()
          sileo.success({
            title: 'Proveedor eliminado',
            duration: 2000,
          })
        },
        onError: (error: any) => {
          sileo.error({
            title: 'Error',
            description: error?.response?.data?.message || 'No se pudo eliminar el proveedor',
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

  const handleModalSuccess = () => {
    refetch()
    handleModalClose()
  }

  if (error) {
    return (
      <motion.div
        className="rounded-lg border border-red-200 bg-red-50 p-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="mb-2 font-semibold text-red-900">Error cargando proveedores</h1>
        <p className="text-red-700">
          {error instanceof Error ? error.message : 'Error desconocido'}
        </p>
      </motion.div>
    )
  }

  return (
    <>
      {/* Header */}
      <motion.div
        className="mb-6 flex items-center justify-between"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h2 className="text-xl font-semibold text-gray-900">Gestión de Proveedores</h2>
        {canCreateSupplier && (
          <button
            onClick={() => {
              setEditingId(null)
              setIsModalOpen(true)
            }}
            className="rounded-lg bg-[#5A804F] px-4 py-2 text-white font-medium hover:bg-[#4a6a3f] flex items-center gap-2 transition-colors"
          >
            <PlusIcon size={18} />
            Crear Proveedor
          </button>
        )}
      </motion.div>

      {/* Búsqueda y Filtros */}
      <motion.div
        className="mb-6 space-y-4 rounded-lg border border-gray-200 bg-white p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <input
          type="text"
          placeholder="Buscar por nombre, email o teléfono..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#5A804F]/20"
        />

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Estado</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter)
              setPage(1)
            }}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#5A804F]/20 md:max-w-xs"
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
      </motion.div>

      {/* Tabla */}
      <motion.div
        className="rounded-lg border border-gray-200 bg-white overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        {isLoading ? (
          <div className="space-y-3 p-6">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">Nombre</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">Email</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">Teléfono</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">Dirección</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900">Estado</th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-900">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data?.data && data.data.length > 0 ? (
                  data.data.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{supplier.name}</td>
                      <td className="px-6 py-4 text-gray-600">{supplier.email || '—'}</td>
                      <td className="px-6 py-4 text-gray-600">{supplier.phone || '—'}</td>
                      <td className="px-6 py-4 text-gray-600 text-sm">{supplier.address || '—'}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            supplier.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {supplier.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {canCreateSupplier && (
                            <>
                              <button
                                onClick={() => handleEditClick(supplier.id)}
                                className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Editar"
                              >
                                <PencilIcon size={16} />
                              </button>
                              <button
                                onClick={() =>
                                  handleToggleActive(supplier.id, supplier.isActive)
                                }
                                disabled={isTogglingActive}
                                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                  supplier.isActive
                                    ? 'text-yellow-600 hover:bg-yellow-50 bg-yellow-50'
                                    : 'text-green-600 hover:bg-green-50 bg-green-50'
                                } disabled:opacity-50`}
                                title={supplier.isActive ? 'Desactivar' : 'Activar'}
                              >
                                {supplier.isActive ? 'Desactivar' : 'Activar'}
                              </button>
                            </>
                          )}
                          {canDeleteSupplier && (
                            <button
                              onClick={() => handleDelete(supplier.id)}
                              disabled={isDeleting || deletingId === supplier.id}
                              className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                              title="Eliminar"
                            >
                              <XIcon size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      {search ? `No encontramos proveedores que coincidan con "${search}"` : 'No hay proveedores registrados'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Paginación */}
      {data && data.pagination.totalPages > 1 && (
        <motion.div
          className="mt-6 flex items-center justify-between"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <p className="text-sm text-gray-600">
            Mostrando {data.pagination.limit} de {data.pagination.total} proveedores
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>
            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(5, data.pagination.totalPages) }).map((_, i) => {
                const pageNum = Math.max(1, page - 2) + i
                if (pageNum > data.pagination.totalPages) return null
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium ${
                      page === pageNum
                        ? 'bg-[#5A804F] text-white'
                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setPage(Math.min(data.pagination.totalPages, page + 1))}
              disabled={page === data.pagination.totalPages}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </motion.div>
      )}

      {/* Modal de Formulario */}
      <SupplierFormModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        editingSupplierId={editingId}
        showSimilarMatches={false}
      />

      {/* Modal de Confirmación de Eliminación */}
      {deletingId && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
          >
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              ¿Eliminar proveedor?
            </h3>
            <p className="mb-6 text-gray-600">
              Esta acción es irreversible. El proveedor será eliminado permanentemente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingId(null)}
                disabled={isDeleting}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleConfirmDelete(deletingId)}
                disabled={isDeleting}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-white font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  )
}
