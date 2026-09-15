import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sileo } from 'sileo'
import { Skeleton } from '../../../shared/components/Skeleton'
import {
  useCreateCount,
  useGetCount,
  useAddItem,
  useCompleteCount,
  useApplyAdjustments,
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
  const [countedQty, setCountedQty] = useState('')
  const [notes, setNotes] = useState('')
  const [isConfirmingApply, setIsConfirmingApply] = useState(false)

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
  const { data: recentCounts, isLoading: isLoadingRecent } = useCountsList({ limit: 10 })
  const { data: ingredients } = useInventoryList({
    page: 1,
    limit: 1000,
    status: 'all',
    search: undefined,
  })
  const { mutate: addItem, isPending: isAddingItem } = useAddItem(countId)
  const { mutate: completeCount, isPending: isCompleting } = useCompleteCount(countId)
  const { mutate: applyAdjustments, isPending: isApplying } = useApplyAdjustments(countId)

  const handleCreateCount = () => {
    createCount(undefined, {
      onSuccess: (newCount) => {
        setCountId(newCount.id)
        setSelectedIngredientId('')
        setCountedQty('')
        setNotes('')
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

  const handleAddItem = () => {
    if (!selectedIngredientId || !countedQty) {
      sileo.error({
        title: 'Campos requeridos',
        description: 'Selecciona un ingrediente y cantidad.',
      })
      return
    }

    addItem(
      {
        ingredientId: selectedIngredientId,
        countedQuantity: parseFloat(countedQty),
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          setSelectedIngredientId('')
          setCountedQty('')
          setNotes('')
          sileo.success({ title: 'Ingrediente agregado.', duration: 2000 })
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
    const badge = badges[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
    return <span className={`px-2 py-1 rounded-full text-sm font-medium ${badge.color}`}>{badge.label}</span>;
  };

  const getDifferenceColor = (diff: number) => {
    if (diff > 0) return 'text-green-600 font-semibold';
    if (diff < 0) return 'text-red-600 font-semibold';
    return 'text-gray-500';
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

        <div className="rounded-lg bg-white p-6 text-center shadow">
          <p className="mb-6 text-gray-600">
            Crear un nuevo conteo físico para reconciliar el inventario del sistema con el real
          </p>
          <button
            onClick={handleCreateCount}
            disabled={isCreating || !canCount}
            className="rounded-lg bg-[#5A804F] px-6 py-3 text-white hover:bg-[#4A6B3F] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {isCreating ? 'Creando...' : 'Crear nuevo conteo'}
          </button>
        </div>

        <div className="mt-6 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-bold">Conteos recientes</h2>
          {isLoadingRecent ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : !recentCounts?.data.length ? (
            <p className="text-sm text-gray-500">No hay conteos registrados aún.</p>
          ) : (
            <div className="divide-y divide-gray-200">
              {recentCounts.data.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCountId(c.id)}
                  className="flex w-full items-center justify-between py-3 text-left transition-colors hover:bg-gray-50"
                  type="button"
                >
                  <div>
                    <p className="font-medium text-gray-900">Conteo #{c.id.slice(0, 8)}</p>
                    <p className="text-sm text-gray-500">
                      {c.createdBy.name} · {new Date(c.createdAt).toLocaleDateString('es-ES')} ·{' '}
                      {c.items.length} item(s)
                    </p>
                  </div>
                  {getStatusBadge(c.status)}
                </button>
              ))}
            </div>
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
        <p className="text-red-600">Conteo no encontrado</p>
      </div>
    )
  }

  const countedIngredients = new Set(count.items.map((i) => i.ingredientId));
  const availableIngredients = (ingredients?.data || []).filter(
    (ing) => !countedIngredients.has(ing.id),
  );

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
          <button
            onClick={() => setCountId(null)}
            className="rounded-lg px-4 py-2 text-gray-600 hover:bg-gray-100 transition-colors"
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
            className="rounded-lg bg-[#F0F7E8] p-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <p className="text-sm text-gray-600">{stat.label}</p>
            <p className="font-semibold">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Agregar items (si está en draft) */}
      <AnimatePresence>
        {count.status === 'draft' && (
          <motion.div
            className={`mb-6 rounded-lg bg-white p-6 shadow ${!canCount ? 'opacity-50 pointer-events-none' : ''}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <h2 className="mb-4 text-lg font-bold">Agregar Ingrediente</h2>

            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Ingrediente
                </label>
                <select
                  value={selectedIngredientId}
                  onChange={(e) => setSelectedIngredientId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 transition-colors focus:border-[#5A804F] focus:ring-2 focus:ring-[#5A804F]/20"
                >
                  <option value="">Seleccionar...</option>
                  {availableIngredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.sku}) - Stock: {ing.currentStock} {ing.unit?.abbreviation}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Cantidad Contada
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={countedQty}
                  onChange={(e) => setCountedQty(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 transition-colors focus:border-[#5A804F] focus:ring-2 focus:ring-[#5A804F]/20"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Notas (opcional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: dañado, encontrado en bodega..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 transition-colors focus:border-[#5A804F] focus:ring-2 focus:ring-[#5A804F]/20"
                />
              </div>
            </div>

            <motion.button
              onClick={handleAddItem}
              disabled={!selectedIngredientId || !countedQty || isAddingItem}
              className="rounded-lg bg-[#5A804F] px-6 py-2 text-white hover:bg-[#4A6B3F] disabled:opacity-50 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isAddingItem ? 'Agregando...' : 'Agregar item'}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabla de items */}
      <div className="mb-6 overflow-hidden rounded-lg bg-white shadow">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                Ingrediente
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                Sistema
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                Contado
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                Diferencia
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                Notas
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <AnimatePresence mode="popLayout">
              {count.items.map((item, i) => (
                <motion.tr
                  key={item.ingredientId}
                  className="hover:bg-gray-50 transition-colors"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2, delay: i * 0.02 }}
                >
                  <td className="px-6 py-3">
                    <div className="font-medium">{item.ingredient?.name}</div>
                    <div className="text-sm text-gray-500">{item.ingredient?.sku}</div>
                  </td>
                  <td className="px-6 py-3">
                    {item.systemQuantity} {item.ingredient?.unit?.abbreviation}
                  </td>
                  <td className="px-6 py-3">
                    {item.countedQuantity} {item.ingredient?.unit?.abbreviation}
                  </td>
                  <td className={`px-6 py-3 ${getDifferenceColor(parseFloat(item.difference.toString()))}`}>
                    {parseFloat(item.difference.toString()) > 0 ? '+' : ''}
                    {item.difference} {item.ingredient?.unit?.abbreviation}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {item.notes || '-'}
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>

        {count.items.length === 0 && (
          <div className="p-6 text-center text-gray-500">
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
              className="rounded-lg bg-green-600 px-6 py-3 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isApplying ? 'Aplicando...' : 'Aplicar ajustes'}
            </motion.button>
          </div>
        )}

        {count.status === 'applied' && (
          <motion.div
            className="rounded-lg bg-green-50 p-4 text-green-700"
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
              className="w-full rounded-t-lg bg-white p-6 sm:w-auto sm:rounded-lg"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <h3 className="mb-2 text-lg font-semibold">Confirmar aplicación de ajustes</h3>
              <p className="mb-6 text-gray-600">
                Esto aplicará {count.items.filter((i) => i.difference.toString() !== '0').length}{' '}
                ajustes al inventario. ¿Continuar?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsConfirmingApply(false)}
                  disabled={isApplying}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-900 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleApplyAdjustments}
                  disabled={isApplying}
                  className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {isApplying ? 'Aplicando...' : 'Confirmar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
