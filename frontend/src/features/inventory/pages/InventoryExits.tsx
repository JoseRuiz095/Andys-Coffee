import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sileo } from 'sileo'
import { Skeleton } from '../../../shared/components/Skeleton'
import { useCreateExit } from '../hooks/useInventoryExits'
import { useInventoryList } from '../hooks/useInventory'
import { useInventoryMovements } from '../hooks/useInventory'
import { EXIT_REASON_LABELS, type ExitReason } from '../api/inventory-exits.api'

const TAILWIND_INPUT_CLASS =
  'w-full rounded-lg border border-gray-300 px-3 py-2 transition-colors focus:border-[#5A804F] focus:ring-2 focus:ring-[#5A804F]/20'

function getApiErrorMessage(error: any, fallback: string): string {
  if (error?.response?.data?.error) return error.response.data.error;
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.message) return error.message;
  return fallback;
}

function getMovementTypeColor(type: string): string {
  switch (type) {
    case 'exit':
      return 'text-purple-600 bg-purple-50'
    case 'sale':
      return 'text-red-600 bg-red-50'
    case 'purchase':
      return 'text-green-600 bg-green-50'
    case 'sale_reversal':
      return 'text-orange-600 bg-orange-50'
    case 'adjustment':
      return 'text-blue-600 bg-blue-50'
    default:
      return 'text-gray-600 bg-gray-50'
  }
}

function getMovementTypeLabel(type: string): string {
  switch (type) {
    case 'exit':
      return 'Salida manual'
    case 'sale':
      return 'Venta'
    case 'purchase':
      return 'Compra'
    case 'sale_reversal':
      return 'Reversión de venta'
    case 'adjustment':
      return 'Ajuste'
    default:
      return type
  }
}

export function InventoryExits() {
  const [selectedIngredientId, setSelectedIngredientId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState<ExitReason>('waste')
  const [notes, setNotes] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)

  const { data: ingredientsData, isLoading: isLoadingIngredients } = useInventoryList({
    page: 1,
    limit: 1000,
    isActive: true,
  })

  const { data: movementsData, isLoading: isLoadingMovements } = useInventoryMovements({
    page: 1,
    limit: 10,
    type: 'exit',
  })

  const { mutate: createExit, isPending: isCreatingExit } = useCreateExit()

  const selectedIngredient = ingredientsData?.data?.find(
    (ing) => ing.id === selectedIngredientId
  )

  const handleAddExit = () => {
    if (!selectedIngredientId) {
      sileo.error({ title: 'Ingrediente requerido', description: 'Selecciona un ingrediente.' })
      return
    }

    if (!quantity || parseFloat(quantity) <= 0) {
      sileo.error({ title: 'Cantidad inválida', description: 'Ingresa una cantidad mayor a cero.' })
      return
    }

    setIsConfirming(true)
  }

  const handleConfirmExit = () => {
    const qty = parseFloat(quantity)

    if (!selectedIngredient || qty > selectedIngredient.currentStock) {
      sileo.error({
        title: 'Stock insuficiente',
        description: `Disponible: ${selectedIngredient?.currentStock.toFixed(2) || 0}`,
      })
      setIsConfirming(false)
      return
    }

    createExit(
      {
        ingredientId: selectedIngredientId,
        quantity: qty,
        reason,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          sileo.success({ title: 'Salida registrada', duration: 2000 })
          setSelectedIngredientId('')
          setQuantity('')
          setReason('waste')
          setNotes('')
          setIsConfirming(false)
        },
        onError: (error: any) => {
          sileo.error({
            title: 'Error registrando salida',
            description: getApiErrorMessage(error, 'Intenta de nuevo'),
          })
        },
      }
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
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Salidas Manuales</h1>
          <p className="text-gray-600">Registra mermas, muestras, consumo interno o donaciones</p>
        </motion.div>

        {/* Formulario */}
        <motion.div
          className="mb-6 rounded-lg border border-gray-200 bg-white p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Registrar Salida</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Ingrediente */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Ingrediente</label>
              {isLoadingIngredients ? (
                <Skeleton className="h-10" />
              ) : (
                <select
                  value={selectedIngredientId}
                  onChange={(e) => setSelectedIngredientId(e.target.value)}
                  className={TAILWIND_INPUT_CLASS}
                >
                  <option value="">Selecciona un ingrediente</option>
                  {ingredientsData?.data?.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.currentStock.toFixed(2)} {ing.unit.abbreviation})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Cantidad */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Cantidad</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0.00"
                className={TAILWIND_INPUT_CLASS}
              />
            </div>

            {/* Motivo */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Motivo</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as ExitReason)}
                className={TAILWIND_INPUT_CLASS}
              >
                {Object.entries(EXIT_REASON_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Stock disponible */}
            {selectedIngredient && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Stock Disponible
                </label>
                <div className="flex items-center rounded-lg border border-gray-300 bg-gray-50 px-3 py-2">
                  <span className="text-sm font-medium text-gray-900">
                    {selectedIngredient.currentStock.toFixed(2)}{' '}
                    <span className="text-gray-600">{selectedIngredient.unit.abbreviation}</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Notas */}
          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-gray-700">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Se rompió el empaque, producto defectuoso..."
              maxLength={500}
              rows={3}
              className={`${TAILWIND_INPUT_CLASS} resize-none`}
            />
            <p className="mt-1 text-xs text-gray-500">{notes.length}/500</p>
          </div>

          {/* Botón */}
          <motion.button
            onClick={handleAddExit}
            disabled={isCreatingExit || !selectedIngredientId || !quantity}
            className="mt-6 rounded-lg bg-[#5A804F] px-6 py-2 text-white font-medium transition-colors hover:bg-[#4a6a3f] disabled:cursor-not-allowed disabled:opacity-50"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isCreatingExit ? 'Registrando...' : 'Registrar Salida'}
          </motion.button>
        </motion.div>

        {/* Salidas Recientes */}
        <motion.div
          className="rounded-lg border border-gray-200 bg-white"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Salidas Recientes</h2>
          </div>

          {isLoadingMovements ? (
            <div className="space-y-3 p-6">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : !movementsData?.data?.length ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">No hay salidas registradas</p>
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
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {movementsData?.data?.map((movement, i) => (
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
                        <div className="text-red-600">
                          {Number(movement.quantity).toFixed(2)}{' '}
                          <span className="text-gray-500">{movement.ingredient.unit.abbreviation}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{movement.notes || '—'}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* Confirmation Modal */}
        <AnimatePresence>
          {isConfirming && (
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
              >
                <h3 className="mb-2 text-lg font-semibold text-gray-900">Confirmar Salida</h3>
                <p className="mb-6 text-gray-600">
                  ¿Descontar {parseFloat(quantity || '0').toFixed(2)} {selectedIngredient?.unit.abbreviation} de{' '}
                  <strong>{selectedIngredient?.name}</strong>?
                </p>
                {notes && (
                  <p className="mb-4 text-sm text-gray-600">
                    <span className="font-medium">Notas:</span> {notes}
                  </p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsConfirming(false)}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 font-medium transition-colors hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmExit}
                    disabled={isCreatingExit}
                    className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-white font-medium transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isCreatingExit ? 'Registrando...' : 'Confirmar'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
