import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sileo } from 'sileo'
import { Skeleton } from '../../../shared/components/Skeleton'
import { useCreatePurchase, usePurchasesList } from '../hooks/usePurchases'
import { useSearchIngredients } from '../hooks/useInventory'

const TAILWIND_INPUT_CLASS =
  'w-full rounded-lg border border-gray-300 px-3 py-2 transition-colors focus:border-[#5A804F] focus:ring-2 focus:ring-[#5A804F]/20'

function getApiErrorMessage(error: any, fallback: string): string {
  if (error?.response?.data?.error) return error.response?.data?.error
  if (error?.response?.data?.message) return error.response?.data?.message
  if (error?.message) return error.message
  return fallback
}

interface PurchaseItem {
  ingredientId: string
  quantity: number
  unitCost: number
}

export function InventoryAddEntry() {
  const [supplierId, setSupplier] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [tax, setTax] = useState('')
  const [items, setItems] = useState<PurchaseItem[]>([])
  const [selectedIngredient, setSelectedIngredient] = useState('')
  const [itemQuantity, setItemQuantity] = useState('')
  const [itemCost, setItemCost] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)

  // Búsqueda dinámica de ingredientes
  const { data: searchResults, isLoading: isSearching } = useSearchIngredients(ingredientSearch)

  const { mutate: createPurchase, isPending: isCreating } = useCreatePurchase()
  const { refetch: refetchPurchases } = usePurchasesList({ status: 'draft', limit: 100 })

  // Encontrar ingrediente seleccionado en resultados de búsqueda
  const selectedIngredientData = useMemo(() => {
    if (!selectedIngredient || !searchResults) return null
    return searchResults.find((ing) => ing.id === selectedIngredient)
  }, [selectedIngredient, searchResults])

  // Filtrar resultados de búsqueda
  const filteredSearchResults = useMemo(() => {
    if (!searchResults) return []
    return searchResults.filter((ing) => ing.id !== selectedIngredient)
  }, [searchResults, selectedIngredient])

  const handleAddItem = () => {
    if (!selectedIngredient || !itemQuantity || !itemCost) {
      sileo.error({
        title: 'Campos incompletos',
        description: 'Selecciona ingrediente, cantidad y costo unitario.',
      })
      return
    }

    const qty = parseFloat(itemQuantity)
    const cost = parseFloat(itemCost)

    if (qty <= 0 || cost <= 0) {
      sileo.error({
        title: 'Valores inválidos',
        description: 'Cantidad y costo deben ser mayores a cero.',
      })
      return
    }

    setItems([
      ...items,
      {
        ingredientId: selectedIngredient,
        quantity: qty,
        unitCost: cost,
      },
    ])

    setSelectedIngredient('')
    setItemQuantity('')
    setItemCost('')
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleConfirmCreate = () => {
    if (items.length === 0) {
      sileo.error({
        title: 'Sin items',
        description: 'Agrega al menos un item a la compra.',
      })
      return
    }

    createPurchase(
      {
        supplierId: supplierId || undefined,
        invoiceNumber: invoiceNumber || undefined,
        notes: notes || undefined,
        tax: tax ? parseFloat(tax) : undefined,
        items,
      },
      {
        onSuccess: () => {
          sileo.success({ title: 'Compra creada correctamente.', duration: 2000 })
          setSupplier('')
          setInvoiceNumber('')
          setNotes('')
          setTax('')
          setItems([])
          setIsConfirming(false)
          refetchPurchases()
        },
        onError: (error: any) => {
          sileo.error({
            title: 'Error creando compra',
            description: getApiErrorMessage(error, 'Intenta de nuevo'),
          })
        },
      }
    )
  }

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
  const taxAmount = tax ? parseFloat(tax) : 0
  const total = subtotal + taxAmount

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
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Agregar Entrada de Inventario</h1>
          <p className="text-gray-600">Registra una nueva compra de proveedores</p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Formulario */}
          <motion.div
            className="lg:col-span-2 rounded-lg border border-gray-200 bg-white p-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Información general */}
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Información de la compra</h2>
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Proveedor (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Nombre del proveedor"
                  value={supplierId}
                  onChange={(e) => setSupplier(e.target.value)}
                  className={TAILWIND_INPUT_CLASS}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Número de factura (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: INV-2024-001"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className={TAILWIND_INPUT_CLASS}
                />
              </div>
            </div>

            {/* Items */}
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Agregar items</h2>
            <div className="mb-6 space-y-4 rounded-lg bg-gray-50 p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* Ingrediente - Búsqueda dinámica */}
                <div className="relative">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Ingrediente
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={selectedIngredient ? '' : 'Buscar por nombre...'}
                      value={
                        selectedIngredient && selectedIngredientData
                          ? selectedIngredientData.name
                          : ingredientSearch
                      }
                      onChange={(e) => {
                        setIngredientSearch(e.target.value)
                        setSelectedIngredient('')
                        setShowSearchResults(true)
                      }}
                      onFocus={() => setShowSearchResults(true)}
                      className={TAILWIND_INPUT_CLASS}
                    />

                    {selectedIngredient && (
                      <button
                        onClick={() => {
                          setSelectedIngredient('')
                          setIngredientSearch('')
                          setShowSearchResults(false)
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        type="button"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <AnimatePresence>
                    {showSearchResults && !selectedIngredient && (ingredientSearch.length >= 2 || filteredSearchResults.length > 0) && (
                      <motion.div
                        className="absolute top-full left-0 right-0 z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        {isSearching ? (
                          <div className="p-3">
                            <Skeleton className="h-8" />
                          </div>
                        ) : filteredSearchResults.length > 0 ? (
                          <div className="divide-y divide-gray-100">
                            {filteredSearchResults.map((ingredient) => (
                              <button
                                key={ingredient.id}
                                onClick={() => {
                                  setSelectedIngredient(ingredient.id)
                                  setIngredientSearch('')
                                  setShowSearchResults(false)
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                                type="button"
                              >
                                <p className="text-sm font-medium text-gray-900">
                                  {ingredient.name}
                                  {ingredient.sku && (
                                    <span className="ml-1 text-xs text-gray-500">({ingredient.sku})</span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {ingredient.currentStock.toFixed(2)} {ingredient.unit.abbreviation}
                                </p>
                              </button>
                            ))}
                          </div>
                        ) : ingredientSearch.length >= 2 ? (
                          <div className="p-3 text-center text-xs text-gray-500">
                            No encontramos ingredientes
                          </div>
                        ) : null}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Cantidad */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Cantidad</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(e.target.value)}
                    placeholder="0.00"
                    className={TAILWIND_INPUT_CLASS}
                  />
                </div>

                {/* Costo unitario */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Costo unitario
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={itemCost}
                    onChange={(e) => setItemCost(e.target.value)}
                    placeholder="0.00"
                    className={TAILWIND_INPUT_CLASS}
                  />
                </div>
              </div>

              {selectedIngredientData && itemQuantity && itemCost && (
                <motion.div
                  className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  Subtotal: ${(parseFloat(itemQuantity) * parseFloat(itemCost)).toFixed(2)}
                </motion.div>
              )}

              <button
                onClick={handleAddItem}
                disabled={!selectedIngredient || !itemQuantity || !itemCost}
                className="w-full rounded-lg bg-[#5A804F] px-4 py-2 text-white font-medium transition-colors hover:bg-[#4a6a3f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Agregar item
              </button>
            </div>

            {/* Lista de items agregados */}
            {items.length > 0 && (
              <motion.div
                className="mb-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <h3 className="mb-3 font-semibold text-gray-900">Items agregados</h3>
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {items.map((item, i) => {
                      const ingredient = ingredientsData?.data?.find((ing) => ing.id === item.ingredientId)
                      return (
                        <motion.div
                          key={i}
                          className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                        >
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {ingredient?.name || 'Ingrediente desconocido'}
                            </p>
                            <p className="text-xs text-gray-600">
                              {item.quantity.toFixed(2)} x ${item.unitCost.toFixed(2)} ={' '}
                              <strong>${(item.quantity * item.unitCost).toFixed(2)}</strong>
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemoveItem(i)}
                            className="ml-2 rounded-lg bg-red-100 px-3 py-1 text-sm text-red-600 hover:bg-red-200"
                          >
                            Quitar
                          </button>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {/* Notas y IVA */}
            <div className="mb-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  IVA (opcional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={tax}
                  onChange={(e) => setTax(e.target.value)}
                  placeholder="0.00"
                  className={TAILWIND_INPUT_CLASS}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Notas (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas sobre la compra..."
                  maxLength={500}
                  rows={3}
                  className={`${TAILWIND_INPUT_CLASS} resize-none`}
                />
              </div>
            </div>

            {/* Botón crear */}
            <button
              onClick={() => setIsConfirming(true)}
              disabled={items.length === 0 || isCreating}
              className="w-full rounded-lg bg-green-600 px-4 py-2 text-white font-medium transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreating ? 'Creando compra...' : 'Crear compra'}
            </button>
          </motion.div>

          {/* Resumen */}
          <motion.div
            className="rounded-lg border border-gray-200 bg-white p-6"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="mb-4 font-semibold text-gray-900">Resumen</h2>

            {items.length === 0 ? (
              <p className="text-sm text-gray-500">Sin items agregados</p>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Items:</span>
                  <span className="font-medium text-gray-900">{items.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium text-gray-900">${subtotal.toFixed(2)}</span>
                </div>
                {taxAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">IVA:</span>
                    <span className="font-medium text-gray-900">${taxAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-3 text-base font-semibold">
                  <span>Total:</span>
                  <span className="text-green-600">${total.toFixed(2)}</span>
                </div>
              </div>
            )}
          </motion.div>
        </div>

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
                <h3 className="mb-2 text-lg font-semibold text-gray-900">
                  Confirmar creación de compra
                </h3>
                <p className="mb-6 text-gray-600">
                  Vas a crear una compra con {items.length} item(s) por un total de{' '}
                  <strong>${total.toFixed(2)}</strong>
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsConfirming(false)}
                    disabled={isCreating}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 font-medium transition-colors hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmCreate}
                    disabled={isCreating}
                    className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-white font-medium transition-colors hover:bg-green-700 disabled:opacity-50"
                  >
                    {isCreating ? 'Creando...' : 'Confirmar'}
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
