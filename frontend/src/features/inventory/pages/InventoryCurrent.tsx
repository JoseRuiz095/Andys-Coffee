import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Skeleton } from '../../../shared/components/Skeleton'
import { useInventoryList } from '../hooks/useInventory'
import { InventoryStats } from '../components/InventoryStats'
import { InventoryAlerts } from '../components/InventoryAlerts'
import { InventoryTable } from '../components/InventoryTable'
import type { UseInventoryListParams } from '../hooks/useInventory'

export function InventoryCurrent() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'normal' | 'low_stock' | 'out_of_stock'>('all')

  const queryParams: UseInventoryListParams = {
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status,
  };

  const { data, isLoading, error } = useInventoryList(queryParams);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const handleStatusChange = (newStatus: typeof status) => {
    setStatus(newStatus);
    setPage(1);
  };

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
            <h1 className="mb-2 font-semibold text-red-900">Error cargando inventario</h1>
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
          className="mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Inventario Actual</h1>
          <p className="text-gray-600">Control de ingredientes y suministros</p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <InventoryStats />
        </motion.div>

        {/* Alerts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <InventoryAlerts />
        </motion.div>

        {/* Búsqueda y Filtros */}
        <motion.div
          className="mb-6 rounded-lg border border-gray-200 bg-white p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Búsqueda */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Buscar por nombre o SKU
              </label>
              <input
                type="text"
                placeholder="Ej: Café, CAF-001..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#5A804F]/20"
              />
            </div>

            {/* Estado Selector */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Filtrar por estado
              </label>
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value as typeof status)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#5A804F]/20"
              >
                <option value="all">Todos</option>
                <option value="normal">Normal</option>
                <option value="low_stock">Stock Bajo</option>
                <option value="out_of_stock">Agotado</option>
              </select>
            </div>
          </div>

          {/* Info de filtros activos */}
          {(search || status !== 'all') && (
            <motion.div
              className="flex items-center gap-2 text-sm text-gray-600"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <span>Filtros activos:</span>
              {search && (
                <button
                  onClick={() => handleSearch('')}
                  className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 hover:bg-gray-200 transition-colors"
                >
                  Búsqueda: "{search}" ✕
                </button>
              )}
              {status !== 'all' && (
                <button
                  onClick={() => handleStatusChange('all')}
                  className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 hover:bg-gray-200 transition-colors"
                >
                  Estado: {status} ✕
                </button>
              )}
            </motion.div>
          )}
        </motion.div>

        {/* Tabla */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
        >
          {isLoading ? (
            <div className="space-y-3 rounded-lg bg-white p-6">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <InventoryTable
              ingredients={data?.data || []}
              isLoading={isLoading}
            />
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
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
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
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                Siguiente
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
