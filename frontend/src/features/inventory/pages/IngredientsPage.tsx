import { useState } from 'react'
import { motion } from 'framer-motion'
import { Skeleton } from '../../../shared/components/Skeleton'
import { useInventoryList, useSetIngredientActive } from '../hooks/useInventory'
import { IngredientFormModal } from '../components/IngredientFormModal'
import { authStore } from '../../../features/auth/store/auth.store'

export function IngredientsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const user = authStore.getState().user
  const canCreateIngredient = user?.permissions?.includes('inventory.create_ingredient') ?? false

  const { data, isLoading, error } = useInventoryList({
    page,
    limit: 20,
    search: search || undefined,
    isActive: true,
  })

  const { mutate: setActive, isPending: isTogglingActive } = useSetIngredientActive()

  const handleToggleActive = (id: string, currentActive: boolean) => {
    setActive(
      { id, isActive: !currentActive },
      {
        onError: (error: any) => {
          console.error('Error toggling active:', error)
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
    handleModalClose()
  }

  if (error) {
    return (
      <motion.div
        className="min-h-screen bg-gray-50 p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="mx-auto max-w-7xl">
          <motion.div
            className="rounded-lg border border-red-200 bg-red-50 p-6"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="mb-2 font-semibold text-red-900">Error cargando ingredientes</h1>
            <p className="text-red-700">
              {error instanceof Error ? error.message : 'Error desconocido'}
            </p>
          </motion.div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="min-h-screen bg-gray-50 p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          className="mb-6 flex items-center justify-between"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div>
            <h1 className="mb-2 text-3xl font-bold text-gray-900">Ingredientes</h1>
            <p className="text-gray-600">Gestiona tu catálogo de ingredientes</p>
          </div>
          {canCreateIngredient && (
            <button
              onClick={() => {
                setEditingId(null)
                setIsModalOpen(true)
              }}
              className="rounded-lg bg-[#5A804F] px-4 py-2 text-white font-medium hover:bg-[#4a6a3f]"
            >
              + Crear Ingrediente
            </button>
          )}
        </motion.div>

        {/* Búsqueda */}
        <motion.div
          className="mb-6 rounded-lg border border-gray-200 bg-white p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <input
            type="text"
            placeholder="Buscar por nombre o SKU..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#5A804F]/20"
          />
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
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">SKU</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Nombre</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Unidad</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Stock Mínimo</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Stock Actual</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-900">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data?.data && data.data.length > 0 ? (
                    data.data.map((ingredient) => (
                      <tr key={ingredient.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {ingredient.sku || '—'}
                        </td>
                        <td className="px-6 py-4 text-gray-900">{ingredient.name}</td>
                        <td className="px-6 py-4 text-gray-600">{ingredient.unit.abbreviation}</td>
                        <td className="px-6 py-4 text-gray-600">{Number(ingredient.minimumStock).toFixed(2)}</td>
                        <td className="px-6 py-4 text-gray-600">{Number(ingredient.currentStock).toFixed(2)}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {canCreateIngredient && (
                              <>
                                <button
                                  onClick={() => handleEditClick(ingredient.id)}
                                  className="rounded px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() =>
                                    handleToggleActive(ingredient.id, ingredient.isActive)
                                  }
                                  disabled={isTogglingActive}
                                  className="rounded px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                                >
                                  {ingredient.isActive ? 'Desactivar' : 'Activar'}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        {search ? `No encontramos ingredientes que coincidan con "${search}"` : 'No hay ingredientes registrados'}
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
              Mostrando {data.pagination.limit} de {data.pagination.total} ingredientes
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
      </div>

      {/* Modal */}
      <IngredientFormModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        editingIngredientId={editingId}
      />
    </motion.div>
  )
}
