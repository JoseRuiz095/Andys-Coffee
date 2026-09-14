import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Skeleton } from '../../../shared/components/Skeleton'
import { useInventoryMovements } from '../hooks/useInventory'
import type { UseInventoryMovementsParams } from '../hooks/useInventory'

const MOVEMENT_TYPES = [
  { value: 'sale', label: 'Venta' },
  { value: 'purchase', label: 'Compra' },
  { value: 'sale_reversal', label: 'Reversión de venta' },
  { value: 'adjustment', label: 'Ajuste' },
  { value: 'exit', label: 'Salida manual' },
]

function getMovementTypeLabel(type: string): string {
  const found = MOVEMENT_TYPES.find((t) => t.value === type)
  return found ? found.label : type
}

function getMovementTypeColor(type: string): string {
  switch (type) {
    case 'sale':
      return 'text-red-600 bg-red-50'
    case 'purchase':
      return 'text-green-600 bg-green-50'
    case 'sale_reversal':
      return 'text-orange-600 bg-orange-50'
    case 'adjustment':
      return 'text-blue-600 bg-blue-50'
    case 'exit':
      return 'text-purple-600 bg-purple-50'
    default:
      return 'text-gray-600 bg-gray-50'
  }
}

export function InventoryMovements() {
  const [page, setPage] = useState(1)
  const [filterType, setFilterType] = useState<string>('')
  const [searchIngredient, setSearchIngredient] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const queryParams: UseInventoryMovementsParams = {
    page,
    limit: 50,
    type: filterType || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };

  const { data, isLoading, error } = useInventoryMovements(queryParams);

  const handleSearch = useCallback((value: string) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    setSearchIngredient(value);
    setPage(1);

    const timer = setTimeout(() => {
      // Query reruns automatically
    }, 300);

    setDebounceTimer(timer);
  }, [debounceTimer]);

  const handleTypeChange = (newType: string) => {
    setFilterType(newType);
    setPage(1);
  };

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') {
      setStartDate(value);
    } else {
      setEndDate(value);
    }
    setPage(1);
  };

  // Filter by ingredient name client-side (optional, since we could add server-side search)
  let filteredMovements = data?.data || [];
  if (searchIngredient) {
    filteredMovements = filteredMovements.filter((m) =>
      m.ingredient.name.toLowerCase().includes(searchIngredient.toLowerCase()) ||
      (m.ingredient.sku && m.ingredient.sku.toLowerCase().includes(searchIngredient.toLowerCase()))
    );
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
            <h1 className="mb-2 font-semibold text-red-900">Error cargando movimientos</h1>
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
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Historial de Movimientos</h1>
          <p className="text-gray-600">Trazabilidad completa de cambios en inventario</p>
        </motion.div>

        {/* Filtros */}
        <motion.div
          className="mb-6 rounded-lg border border-gray-200 bg-white p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Búsqueda de ingrediente */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Ingrediente
              </label>
              <input
                type="text"
                placeholder="Buscar por nombre o SKU..."
                value={searchIngredient}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#5A804F]/20"
              />
            </div>

            {/* Tipo de movimiento */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Tipo de movimiento
              </label>
              <select
                value={filterType}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#5A804F]/20"
              >
                <option value="">Todos</option>
                {MOVEMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Fecha desde */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Desde
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleDateChange('start', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#5A804F]/20"
              />
            </div>

            {/* Fecha hasta */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Hasta
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleDateChange('end', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#5A804F]/20"
              />
            </div>
          </div>

          {/* Filtros activos */}
          {(searchIngredient || filterType || startDate || endDate) && (
            <motion.div
              className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-600"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <span>Filtros activos:</span>
              {searchIngredient && (
                <button
                  onClick={() => handleSearch('')}
                  className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 hover:bg-gray-200 transition-colors"
                >
                  Ingrediente: "{searchIngredient}" ✕
                </button>
              )}
              {filterType && (
                <button
                  onClick={() => handleTypeChange('')}
                  className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 hover:bg-gray-200 transition-colors"
                >
                  Tipo: {getMovementTypeLabel(filterType)} ✕
                </button>
              )}
              {startDate && (
                <button
                  onClick={() => handleDateChange('start', '')}
                  className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 hover:bg-gray-200 transition-colors"
                >
                  Desde: {startDate} ✕
                </button>
              )}
              {endDate && (
                <button
                  onClick={() => handleDateChange('end', '')}
                  className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 hover:bg-gray-200 transition-colors"
                >
                  Hasta: {endDate} ✕
                </button>
              )}
            </motion.div>
          )}
        </motion.div>

        {/* Tabla de movimientos */}
        <motion.div
          className="overflow-hidden rounded-lg border border-gray-200 bg-white"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">No hay movimientos para mostrar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Fecha</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">
                      Ingrediente
                    </th>
                    <th className="px-6 py-3 text-center font-semibold text-gray-900">Tipo</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-900">Cantidad</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-900">Costo Unit.</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Origen</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Usuario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredMovements.map((movement, i) => (
                    <motion.tr
                      key={movement.id}
                      className="transition-colors hover:bg-gray-50"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                    >
                      <td className="px-6 py-4 text-gray-600">
                        {new Date(movement.createdAt).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{movement.ingredient.name}</p>
                        <p className="text-xs text-gray-600">
                          {movement.ingredient.sku || '—'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getMovementTypeColor(movement.type)}`}
                        >
                          {getMovementTypeLabel(movement.type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div
                          className={
                            Number(movement.quantity) < 0 ? 'text-red-600' : 'text-green-600'
                          }
                        >
                          {Number(movement.quantity) > 0 ? '+' : ''}
                          {Number(movement.quantity).toFixed(2)}{' '}
                          <span className="text-gray-500">
                            {movement.ingredient.unit.abbreviation}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">
                        ${Number(movement.unitCost).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {movement.referenceType ? (
                          <div>
                            <p className="font-medium">{movement.referenceType}</p>
                            {movement.referenceId && (
                              <p className="text-xs text-gray-500">
                                {movement.referenceId.substring(0, 8)}...
                              </p>
                            )}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {movement.createdBy ? (
                          <p className="font-medium text-gray-900">{movement.createdBy.name}</p>
                        ) : (
                          <p className="text-gray-500">Sistema</p>
                        )}
                      </td>
                    </motion.tr>
                  ))}
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
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <p className="text-sm text-gray-600">
              Mostrando {filteredMovements.length} de {data.pagination.total} movimientos
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
