import { useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { sileo } from 'sileo'
import { Skeleton } from '../../../shared/components/Skeleton'
import { useDraftPurchases, useReceivePurchase, usePurchaseById } from '../hooks/usePurchases'
import axios from 'axios'

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

export function InventoryEntries() {
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null)
  const [isConfirmingReceive, setIsConfirmingReceive] = useState(false)
  const [searchSupplier, setSearchSupplier] = useState('')

  const { data: purchases, isLoading: isLoadingPurchases, error: purchasesError } = useDraftPurchases()
  const { data: selectedPurchase, isLoading: isLoadingDetail } = usePurchaseById(selectedPurchaseId || '')
  const { mutate: receivePurchase, isPending: isReceiving } = useReceivePurchase()

  const handleReceivePurchase = () => {
    if (!selectedPurchaseId) return

    receivePurchase(selectedPurchaseId, {
      onSuccess: () => {
        setIsConfirmingReceive(false)
        setSelectedPurchaseId(null)
        sileo.success({ title: 'Compra recibida correctamente.', duration: 3000 })
      },
      onError: (error) => {
        sileo.error({
          title: 'Error al recibir la compra',
          description: getApiErrorMessage(error, 'Inténtalo de nuevo.'),
        })
      },
    })
  }

  const draftPurchases = purchases?.data || []

  // Filtrar compras por nombre de proveedor
  const filteredPurchases = useMemo(
    () => draftPurchases.filter(p =>
      p.supplier?.name.toLowerCase().includes(searchSupplier.toLowerCase()) ||
      p.invoiceNumber?.toLowerCase().includes(searchSupplier.toLowerCase())
    ),
    [draftPurchases, searchSupplier]
  )

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
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Entradas de Inventario</h1>
          <p className="text-gray-600">Recibir compras de proveedores</p>
        </motion.div>

        {purchasesError && (
          <motion.div
            className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-red-800">Error cargando compras</p>
          </motion.div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_3fr]">
          {/* Lista de compras pendientes */}
          <motion.div
            className="rounded-lg border border-gray-200 bg-white p-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="mb-4 font-semibold text-gray-900">
              Compras pendientes ({filteredPurchases.length})
            </h2>

            {/* Búsqueda */}
            <motion.input
              type="text"
              placeholder="Buscar por proveedor o factura..."
              value={searchSupplier}
              onChange={(e) => setSearchSupplier(e.target.value)}
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-[#5A804F] focus:ring-2 focus:ring-[#5A804F]/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            />

            {isLoadingPurchases ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : filteredPurchases.length === 0 ? (
              <p className="text-sm text-gray-500">
                {draftPurchases.length === 0 ? 'No hay compras pendientes' : 'No hay coincidencias'}
              </p>
            ) : (
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {filteredPurchases.map((purchase, i) => (
                    <motion.button
                      key={purchase.id}
                      onClick={() => setSelectedPurchaseId(purchase.id)}
                      className={`w-full rounded-lg border-2 p-3 text-left transition-colors ${
                        selectedPurchaseId === purchase.id
                          ? 'border-[#5A804F] bg-[#F0F7E8]'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.2, delay: i * 0.05 }}
                      whileHover={{ scale: 1.01 }}
                    >
                      <p className="font-medium text-gray-900">
                        {purchase.supplier?.name || 'Proveedor sin nombre'}
                      </p>
                      <p className="text-sm text-gray-600">
                        {purchase.items.length} items • ${Number(purchase.total).toFixed(2)}
                      </p>
                      {purchase.invoiceNumber && (
                        <p className="text-xs text-gray-500">
                          Factura: {purchase.invoiceNumber}
                        </p>
                      )}
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>

          {/* Detalle de compra seleccionada */}
          <AnimatePresence mode="wait">
            {selectedPurchaseId && !isLoadingDetail && selectedPurchase ? (
              <motion.div
                key="detail"
                className="rounded-lg border border-gray-200 bg-white p-6"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="mb-4 font-semibold text-gray-900">Detalle de entrada</h2>

                {/* Advertencia de cambios */}
                <motion.div
                  className="mb-6 rounded-lg border-l-4 border-blue-500 bg-blue-50 p-4"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <p className="text-sm font-medium text-blue-900">
                    Se actualizarán {selectedPurchase.items.length} ingrediente(s) en el inventario
                  </p>
                  <ul className="mt-2 space-y-1">
                    {selectedPurchase.items.map((item) => (
                      <li key={item.id} className="text-xs text-blue-800">
                        + {Number(item.quantity).toFixed(2)} {item.ingredient.unit.abbreviation} de{' '}
                        <strong>{item.ingredient.name}</strong>
                      </li>
                    ))}
                  </ul>
                </motion.div>

                {/* Supplier info */}
                {selectedPurchase.supplier && (
                  <motion.div
                    className="mb-4 rounded-lg bg-gray-50 p-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    <p className="font-medium text-gray-900">{selectedPurchase.supplier.name}</p>
                    {selectedPurchase.supplier.email && (
                      <p className="text-sm text-gray-600">{selectedPurchase.supplier.email}</p>
                    )}
                    {selectedPurchase.supplier.phone && (
                      <p className="text-sm text-gray-600">{selectedPurchase.supplier.phone}</p>
                    )}
                  </motion.div>
                )}

                {/* Items table */}
                <motion.div
                  className="mb-4 overflow-x-auto"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                >
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-2 py-2 text-left font-semibold text-gray-900">
                          Ingrediente
                        </th>
                        <th className="px-2 py-2 text-right font-semibold text-gray-900">
                          Cantidad
                        </th>
                        <th className="px-2 py-2 text-right font-semibold text-gray-900">
                          Costo unitario
                        </th>
                        <th className="px-2 py-2 text-right font-semibold text-gray-900">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence mode="popLayout">
                        {selectedPurchase.items.map((item, i) => (
                          <motion.tr
                            key={item.id}
                            className="border-b border-gray-100"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                          >
                            <td className="px-2 py-3">
                              <p className="font-medium text-gray-900">{item.ingredient.name}</p>
                              <p className="text-xs text-gray-600">
                                {item.ingredient.sku || '—'}
                              </p>
                            </td>
                            <td className="px-2 py-3 text-right text-gray-600">
                              {Number(item.quantity).toFixed(2)} {item.ingredient.unit.abbreviation}
                            </td>
                            <td className="px-2 py-3 text-right text-gray-600">
                              ${Number(item.unitCost).toFixed(2)}
                            </td>
                            <td className="px-2 py-3 text-right font-medium text-gray-900">
                              ${(Number(item.quantity) * Number(item.unitCost)).toFixed(2)}
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </motion.div>

                {/* Totals */}
                <motion.div
                  className="mb-6 space-y-2 rounded-lg bg-gray-50 p-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium text-gray-900">
                      ${Number(selectedPurchase.subtotal).toFixed(2)}
                    </span>
                  </div>
                  {selectedPurchase.tax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">IVA:</span>
                      <span className="font-medium text-gray-900">
                        ${Number(selectedPurchase.tax).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold">
                    <span>Total:</span>
                    <span>${Number(selectedPurchase.total).toFixed(2)}</span>
                  </div>
                </motion.div>

                {/* Notes */}
                {selectedPurchase.notes && (
                  <motion.div
                    className="mb-6 rounded-lg bg-blue-50 p-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.25 }}
                  >
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Notas:</span> {selectedPurchase.notes}
                    </p>
                  </motion.div>
                )}

                {/* Receive button */}
                <AnimatePresence mode="wait">
                  {!isConfirmingReceive ? (
                    <motion.button
                      key="receive-btn"
                      onClick={() => setIsConfirmingReceive(true)}
                      disabled={isReceiving}
                      className="w-full rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {isReceiving ? 'Recibiendo...' : 'Recibir compra'}
                    </motion.button>
                  ) : (
                    <motion.div
                      key="confirm-dialog"
                      className="space-y-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <p className="rounded-lg bg-amber-50 p-3 text-sm text-gray-600">
                        ¿Confirmar recepción? Esto actualizará el inventario con los items de esta
                        compra.
                      </p>
                      <div className="flex gap-2">
                        <motion.button
                          onClick={handleReceivePurchase}
                          disabled={isReceiving}
                          className="flex-1 rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {isReceiving ? 'Procesando...' : 'Confirmar'}
                        </motion.button>
                        <motion.button
                          onClick={() => setIsConfirmingReceive(false)}
                          disabled={isReceiving}
                          className="flex-1 rounded-lg bg-gray-200 px-4 py-2 font-medium text-gray-900 transition-colors hover:bg-gray-300 disabled:opacity-50"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          Cancelar
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : selectedPurchaseId && isLoadingDetail ? (
              <motion.div
                key="loading"
                className="rounded-lg border border-gray-200 bg-white p-6"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="mb-4 font-semibold text-gray-900">Cargando detalles...</h2>
                <div className="space-y-4">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-32" />
                  <Skeleton className="h-12" />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                className="flex min-h-96 items-center justify-center rounded-lg border border-gray-200 bg-white p-6 text-center"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <p className="text-gray-500">Selecciona una compra para ver detalles</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Historial de entradas recientes */}
        {draftPurchases.length > 0 && (
          <motion.div
            className="mt-8 rounded-lg border border-gray-200 bg-white p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <h2 className="mb-4 font-semibold text-gray-900">
              Información útil
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <motion.div
                className="rounded-lg bg-blue-50 p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
              >
                <p className="text-sm text-blue-600">Total en espera</p>
                <p className="mt-1 text-2xl font-bold text-blue-900">
                  ${draftPurchases.reduce((sum, p) => sum + Number(p.total), 0).toFixed(2)}
                </p>
              </motion.div>
              <motion.div
                className="rounded-lg bg-green-50 p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <p className="text-sm text-green-600">Compras pendientes</p>
                <p className="mt-1 text-2xl font-bold text-green-900">{draftPurchases.length}</p>
              </motion.div>
              <motion.div
                className="rounded-lg bg-purple-50 p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
              >
                <p className="text-sm text-purple-600">Items totales</p>
                <p className="mt-1 text-2xl font-bold text-purple-900">
                  {draftPurchases.reduce((sum, p) => sum + p.items.length, 0)}
                </p>
              </motion.div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
