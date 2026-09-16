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
        className="min-h-screen p-6"
        style={{ backgroundColor: 'var(--color-background)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="mx-auto max-w-7xl">
          <motion.div
            className="rounded-lg border p-6"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
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
      className="min-h-screen p-6"
      style={{ backgroundColor: 'var(--color-background)' }}
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
          <h1 className="mb-2 text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Inventario Actual</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>Control de ingredientes y suministros</p>
        </motion.div>

        {/* Stats */}
        <motion.div
          className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {/* Total de ingredientes */}
          <div className="rounded-lg border p-6" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Total Ingredientes</p>
            <p className="mt-2 text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{data?.pagination.total || 0}</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>en el inventario</p>
          </div>

          {/* Normal */}
          <div className="rounded-lg border p-6" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Stock Normal</p>
            <p className="mt-2 text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>
              {data?.data?.filter(ing => {
                const current = Number(ing.currentStock);
                const minimum = Number(ing.minimumStock);
                return current > minimum && current > 0;
              }).length || 0}
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>sin problemas de stock</p>
          </div>

          {/* Stock Bajo */}
          <div className="rounded-lg border p-6" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Stock Bajo</p>
            <p className="mt-2 text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>
              {data?.data?.filter(ing => {
                const current = Number(ing.currentStock);
                const minimum = Number(ing.minimumStock);
                return current > 0 && current <= minimum;
              }).length || 0}
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>requiere reorden</p>
          </div>

          {/* Agotado */}
          <div className="rounded-lg border p-6" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Agotados</p>
            <p className="mt-2 text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>
              {data?.data?.filter(ing => Number(ing.currentStock) <= 0).length || 0}
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>requiere reposición urgente</p>
          </div>
        </motion.div>

        {/* Valor Total */}
        <motion.div
          className="mb-6 rounded-lg border-2 p-6"
          style={{ borderColor: 'var(--color-primary)', backgroundColor: 'var(--color-surface)' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>Valor Total del Inventario</p>
          <p className="mt-2 text-4xl font-bold" style={{ color: 'var(--color-primary)' }}>
            ${(data?.data?.reduce((sum, ing) => sum + (Number(ing.currentStock) * Number(ing.averageCost)), 0) || 0).toFixed(2)}
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>costo total de stock en almacén</p>
        </motion.div>

        {/* Stats Original */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
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
          className="mb-6 rounded-lg border p-6"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.35 }}
        >
          <h3 className="mb-4 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Filtrar Inventario</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Búsqueda */}
            <div>
              <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Buscar por nombre o SKU
              </label>
              <input
                type="text"
                placeholder="Ej: Café, CAF-001..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full rounded-lg border px-4 py-2 outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#5A804F]/20"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
              />
            </div>

            {/* Estado Selector */}
            <div>
              <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Filtrar por estado
              </label>
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value as typeof status)}
                className="w-full rounded-lg border px-4 py-2 outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#5A804F]/20"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
              >
                <option value="all">Todos</option>
                <option value="normal">Normal</option>
                <option value="low_stock">Stock Bajo</option>
                <option value="out_of_stock">Agotado</option>
              </select>
            </div>

            {/* Botón Limpiar Filtros */}
            {(search || status !== 'all') && (
              <div className="flex items-end">
                <button
                  onClick={() => {
                    handleSearch('');
                    handleStatusChange('all');
                  }}
                  className="w-full rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text-primary)' }}
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>

          {/* Info de filtros activos */}
          {(search || status !== 'all') && (
            <motion.div
              className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-4 text-sm text-gray-600"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <span className="font-medium">Filtros activos:</span>
              {search && (
                <button
                  onClick={() => handleSearch('')}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200 transition-colors"
                >
                  🔍 "{search}" ✕
                </button>
              )}
              {status !== 'all' && (
                <button
                  onClick={() => handleStatusChange('all')}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200 transition-colors"
                >
                  🏷️ {status === 'normal' ? 'Normal' : status === 'low_stock' ? 'Stock Bajo' : 'Agotado'} ✕
                </button>
              )}
            </motion.div>
          )}
        </motion.div>

        {/* Tabla */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
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
            transition={{ duration: 0.3, delay: 0.45 }}
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
