import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sileo } from 'sileo'
import { Skeleton } from '../../../shared/components/Skeleton'
import { PencilIcon } from '../../../components/ui/PencilIcon'
import { XIcon } from '../../../components/ui/XIcon'
import { useCreatePurchase, usePurchasesList, useSearchSuppliers } from '../hooks/usePurchases'
import { useSearchIngredients } from '../hooks/useInventory'
import { IngredientFormModal } from '../components/IngredientFormModal'
import { SupplierFormModal } from '../components/SupplierFormModal'
import { authStore } from '../../auth/store/auth.store'
import { convertQuantity, convertUnitCost, getCompatibleUnits } from '../utils/unitConversion'

const TAILWIND_INPUT_CLASS =
  'w-full rounded-lg border border-[var(--color-border)] px-3 py-2 transition-colors focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20'

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
  ingredientName?: string
  unitAbbreviation?: string
  capturedQuantity?: number
  capturedUnitCost?: number
  captureUnit?: string
}

export function InventoryAddEntry() {
  const { user } = authStore.getState()
  const canCreateEntry = user?.permissions?.includes('inventory.create_entry') ?? false
  const canCreateIngredient = user?.permissions?.includes('inventory.create_ingredient') ?? false
  const canManageSuppliers = user?.permissions?.includes('inventory.manage_suppliers') ?? false

  const [supplierId, setSupplier] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<PurchaseItem[]>([])
  const [selectedIngredient, setSelectedIngredient] = useState('')
  const [selectedIngredientData, setSelectedIngredientData] = useState<any>(null)
  const [captureUnit, setCaptureUnit] = useState('')
  const [itemQuantity, setItemQuantity] = useState('')
  const [itemCost, setItemCost] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [debouncedIngredientSearch, setDebouncedIngredientSearch] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [isIngredientModalOpen, setIsIngredientModalOpen] = useState(false)
  const [supplierSearch, setSupplierSearch] = useState('')
  const [debouncedSupplierSearch, setDebouncedSupplierSearch] = useState('')
  const [showSupplierResults, setShowSupplierResults] = useState(false)
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)
  const [selectedSupplierData, setSelectedSupplierData] = useState<any>(null)

  // Debounce de las búsquedas para no disparar una petición por cada tecla
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedIngredientSearch(ingredientSearch), 300)
    return () => clearTimeout(timer)
  }, [ingredientSearch])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSupplierSearch(supplierSearch), 300)
    return () => clearTimeout(timer)
  }, [supplierSearch])

  // Búsqueda dinámica de ingredientes
  const { data: searchResults, isLoading: isSearching } = useSearchIngredients(debouncedIngredientSearch)

  // Búsqueda dinámica de proveedores
  const { data: supplierResults, isLoading: isSearchingSuppliers } = useSearchSuppliers(debouncedSupplierSearch)

  const { mutate: createPurchase, isPending: isCreating } = useCreatePurchase()
  const { refetch: refetchPurchases } = usePurchasesList({ status: 'draft', limit: 100 })

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

    // Convert quantity and cost if capture unit differs from base unit
    const baseUnit = selectedIngredientData?.unit.abbreviation
    let finalQuantity = qty
    let finalUnitCost = qty > 0 ? cost / qty : 0 // Costo unitario = costo total / cantidad
    let displayCaptureUnit = captureUnit || baseUnit

    if (captureUnit && captureUnit !== baseUnit) {
      try {
        finalQuantity = convertQuantity(qty, captureUnit, baseUnit)
        finalUnitCost = convertUnitCost(finalUnitCost, captureUnit, baseUnit)
      } catch (err) {
        sileo.error({
          title: 'Error de conversión',
          description: `No se puede convertir de ${captureUnit} a ${baseUnit}`,
        })
        return
      }
    }

    const newItem = {
      ingredientId: selectedIngredient,
      quantity: finalQuantity,
      unitCost: finalUnitCost,
      ingredientName: selectedIngredientData?.name,
      unitAbbreviation: baseUnit,
      capturedQuantity: qty,
      capturedUnitCost: cost,
      captureUnit: displayCaptureUnit,
    }

    if (editingIndex !== null) {
      const updatedItems = [...items]
      updatedItems[editingIndex] = newItem
      setItems(updatedItems)
      setEditingIndex(null)
    } else {
      setItems([...items, newItem])
    }

    setSelectedIngredient('')
    setSelectedIngredientData(null)
    setItemQuantity('')
    setItemCost('')
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))

    // Si el item eliminado era el que se estaba editando (o estaba antes de él),
    // los índices del array se desplazan y editingIndex quedaría apuntando a otro item.
    if (editingIndex !== null && index <= editingIndex) {
      setEditingIndex(null)
      setSelectedIngredient('')
      setSelectedIngredientData(null)
      setItemQuantity('')
      setItemCost('')
    }
  }

  const handleIngredientCreated = (ingredient: any) => {
    setIsIngredientModalOpen(false)
    setSelectedIngredient(ingredient.id)
    setIngredientSearch('')
    setShowSearchResults(false)
  }

  const handleSupplierCreated = (supplier: any) => {
    setIsSupplierModalOpen(false)
    setSupplier(supplier.id)
    setSupplierSearch('')
    setShowSupplierResults(false)
    setSelectedSupplierData(supplier)
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
        notes: notes || undefined,
        items,
      },
      {
        onSuccess: (data: any) => {
          sileo.success({
            title: 'Compra creada correctamente.',
            description: data?.purchase?.invoiceNumber ? `Factura: ${data.purchase.invoiceNumber}` : undefined,
            duration: 3000
          })
          setSupplier('')
          setNotes('')
          setItems([])
          setIsConfirming(false)
          setEditingIndex(null)
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
  const total = subtotal

  return (
    <motion.div
      className="min-h-screen bg-[var(--color-surface-hover)] p-6"
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
          <h1 className="mb-2 text-3xl font-bold text-[var(--color-text-primary)]">Agregar Entrada de Inventario</h1>
          <p className="text-[var(--color-text-secondary)]">Registra una nueva compra de proveedores</p>
        </motion.div>

        {!canCreateEntry && (
          <motion.div
            className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <p className="text-sm font-medium text-yellow-800">
              No tienes permiso para registrar entradas de inventario. Contacta a un administrador.
            </p>
          </motion.div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Formulario */}
          <motion.div
            className={`lg:col-span-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 ${!canCreateEntry ? 'opacity-50 pointer-events-none' : ''}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Información general */}
            <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">Información de la compra</h2>
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Proveedor - Búsqueda dinámica */}
              <div className="relative">
                <label className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">
                  Proveedor (opcional)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={supplierId ? '' : 'Buscar proveedor...'}
                    value={
                      supplierId && selectedSupplierData
                        ? selectedSupplierData.name
                        : supplierSearch
                    }
                    onChange={(e) => {
                      setSupplierSearch(e.target.value)
                      setSupplier('')
                      setShowSupplierResults(true)
                    }}
                    onFocus={() => setShowSupplierResults(true)}
                    onBlur={() => setTimeout(() => setShowSupplierResults(false), 150)}
                    className={TAILWIND_INPUT_CLASS}
                  />

                  {supplierId && (
                    <button
                      onClick={() => {
                        setSupplier('')
                        setSupplierSearch('')
                        setShowSupplierResults(false)
                        setSelectedSupplierData(null)
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[var(--color-text-secondary)]"
                      type="button"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <AnimatePresence>
                  {showSupplierResults && !supplierId && (debouncedSupplierSearch.length >= 2 || supplierResults?.length || 0 > 0) && (
                    <motion.div
                      className="absolute top-full left-0 right-0 z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      {isSearchingSuppliers ? (
                        <div className="p-3">
                          <Skeleton className="h-8" />
                        </div>
                      ) : supplierResults && supplierResults.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                          {supplierResults.map((supplier) => (
                            <button
                              key={supplier.id}
                              onClick={() => {
                                setSupplier(supplier.id)
                                setSupplierSearch('')
                                setShowSupplierResults(false)
                                setSelectedSupplierData(supplier)
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-[var(--color-surface-hover)] transition-colors"
                              type="button"
                            >
                              <p className="text-sm font-medium text-[var(--color-text-primary)]">{supplier.name}</p>
                              {(supplier.phone || supplier.email) && (
                                <p className="text-xs text-[var(--color-text-secondary)]">
                                  {supplier.phone}
                                  {supplier.phone && supplier.email ? ' · ' : ''}
                                  {supplier.email}
                                </p>
                              )}
                            </button>
                          ))}
                        </div>
                      ) : debouncedSupplierSearch.length >= 2 ? (
                        <div className="divide-y divide-gray-100">
                          <div className="p-3 text-center text-xs text-[var(--color-text-secondary)]">
                            No encontramos proveedores
                          </div>
                          {canManageSuppliers && (
                            <button
                              onClick={() => {
                                setIsSupplierModalOpen(true)
                                setShowSupplierResults(false)
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors text-blue-600 font-medium"
                              type="button"
                            >
                              + Crear "{supplierSearch}"
                            </button>
                          )}
                        </div>
                      ) : null}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>

            {/* Items */}
            <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">Agregar items</h2>
            <div className="mb-6 space-y-4 rounded-lg bg-[var(--color-surface-hover)] p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* Ingrediente - Búsqueda dinámica */}
                <div className="relative">
                  <label className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">
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
                      onBlur={() => setTimeout(() => setShowSearchResults(false), 150)}
                      className={TAILWIND_INPUT_CLASS}
                    />

                    {selectedIngredient && (
                      <button
                        onClick={() => {
                          setSelectedIngredient('')
                          setSelectedIngredientData(null)
                          setIngredientSearch('')
                          setShowSearchResults(false)
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[var(--color-text-secondary)]"
                        type="button"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <AnimatePresence>
                    {showSearchResults && !selectedIngredient && (debouncedIngredientSearch.length >= 2 || filteredSearchResults.length > 0) && (
                      <motion.div
                        className="absolute top-full left-0 right-0 z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg"
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
                                  setSelectedIngredientData(ingredient)
                                  setCaptureUnit(ingredient.unit.abbreviation)
                                  setIngredientSearch('')
                                  setShowSearchResults(false)
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-[var(--color-surface-hover)] transition-colors"
                                type="button"
                              >
                                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                                  {ingredient.name}
                                  {ingredient.sku && (
                                    <span className="ml-1 text-xs text-[var(--color-text-secondary)]">({ingredient.sku})</span>
                                  )}
                                </p>
                                <p className="text-xs text-[var(--color-text-secondary)]">
                                  {Number(ingredient.currentStock).toFixed(2)} {ingredient.unit.abbreviation}
                                </p>
                              </button>
                            ))}
                          </div>
                        ) : debouncedIngredientSearch.length >= 2 ? (
                          <div className="divide-y divide-gray-100">
                            <div className="p-3 text-center text-xs text-[var(--color-text-secondary)]">
                              No encontramos ingredientes exactos
                            </div>
                            {canCreateIngredient && (
                              <button
                                onClick={() => {
                                  setIsIngredientModalOpen(true)
                                  setShowSearchResults(false)
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors text-blue-600 font-medium"
                                type="button"
                              >
                                + Crear "{ingredientSearch}"
                              </button>
                            )}
                          </div>
                        ) : null}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Cantidad */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">
                    Cantidad
                  </label>
                  <div className="flex gap-2 items-stretch">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(e.target.value)}
                      placeholder="0.00"
                      className={`${TAILWIND_INPUT_CLASS} flex-1`}
                    />
                    {selectedIngredientData && (
                      <select
                        value={captureUnit}
                        onChange={(e) => setCaptureUnit(e.target.value)}
                        className="rounded-lg border border-[var(--color-border)] px-3 py-2 transition-colors focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 w-28 flex-shrink-0"
                      >
                        <option value={selectedIngredientData.unit.abbreviation}>
                          {selectedIngredientData.unit.abbreviation}
                        </option>
                        {getCompatibleUnits(selectedIngredientData.unit.abbreviation).map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Costo Total */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">
                    Costo Total
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

              {selectedIngredientData && itemQuantity && itemCost && (() => {
                const qty = parseFloat(itemQuantity);
                const totalCost = parseFloat(itemCost);
                const baseUnit = selectedIngredientData.unit.abbreviation;
                const unitCost = qty > 0 ? totalCost / qty : 0;

                let conversionInfo = null;
                if (captureUnit && captureUnit !== baseUnit) {
                  try {
                    const convertedQty = convertQuantity(qty, captureUnit, baseUnit);
                    const convertedCost = convertUnitCost(unitCost, captureUnit, baseUnit);
                    conversionInfo = {
                      capturedQty: qty,
                      capturedUnit: captureUnit,
                      convertedQty: convertedQty,
                      baseUnit: baseUnit,
                      convertedCost: convertedCost,
                    };
                  } catch (err) {
                    // No conversion
                  }
                }

                return (
                  <motion.div
                    className="mt-4 rounded-lg bg-[var(--color-surface-hover)] p-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      Subtotal: <span className="text-[var(--color-success)]">${totalCost.toFixed(2)}</span>
                    </p>
                    {conversionInfo && (
                      <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                        ({conversionInfo.capturedQty} {conversionInfo.capturedUnit} → {conversionInfo.convertedQty.toFixed(4)} {conversionInfo.baseUnit})
                      </p>
                    )}
                  </motion.div>
                );
              })()}

              <button
                onClick={handleAddItem}
                disabled={!selectedIngredient || !itemQuantity || !itemCost}
                className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-2 text-white font-medium transition-colors hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {editingIndex !== null ? 'Actualizar item' : 'Agregar item'}
              </button>
            </div>

            {/* Notas */}
            <div className="mb-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">
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
              className="w-full rounded-lg bg-[var(--color-success)] px-4 py-2 text-white font-medium transition-colors hover:bg-[var(--color-success)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreating ? 'Creando compra...' : 'Crear compra'}
            </button>
          </motion.div>

          {/* Resumen */}
          <motion.div
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="mb-4 font-semibold text-[var(--color-text-primary)]">Resumen</h2>

            {items.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">Sin items agregados</p>
            ) : (
              <div className="space-y-3">
                <div className="max-h-64 overflow-y-auto space-y-2 mb-4">
                  {items.map((item, i) => (
                    <div
                      key={i}
                      className={`rounded-lg p-3 ${editingIndex === i ? 'bg-blue-50 border border-blue-200' : 'bg-[var(--color-surface-hover)]'}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] flex-1">
                          {item.ingredientName}
                        </p>
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() => {
                              setSelectedIngredient(item.ingredientId)
                              setSelectedIngredientData({
                                id: item.ingredientId,
                                name: item.ingredientName,
                                unit: { abbreviation: item.unitAbbreviation }
                              })
                              setItemQuantity((item.capturedQuantity ?? item.quantity).toString())
                              setItemCost((item.capturedUnitCost ?? item.unitCost).toString())
                              setCaptureUnit(item.captureUnit ?? (item.unitAbbreviation || ''))
                              setEditingIndex(i)
                            }}
                            className="p-1 text-[var(--color-text-secondary)] hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            type="button"
                            title="Editar"
                          >
                            <PencilIcon size={16} />
                          </button>
                          <button
                            onClick={() => handleRemoveItem(i)}
                            className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] hover:bg-red-50 rounded transition-colors"
                            type="button"
                            title="Eliminar"
                          >
                            <XIcon size={16} />
                          </button>
                        </div>
                      </div>
                      {item.captureUnit && item.captureUnit !== item.unitAbbreviation ? (
                        <div className="text-xs text-[var(--color-text-secondary)] space-y-1">
                          <p>
                            Capturado: {(item.capturedQuantity ?? 0).toFixed(2)} {item.captureUnit} × ${(item.capturedUnitCost ?? 0).toFixed(2)} = ${((item.capturedQuantity ?? 0) * (item.capturedUnitCost ?? 0)).toFixed(2)}
                          </p>
                          <p>
                            Convertido: {item.quantity.toFixed(2)} {item.unitAbbreviation} × ${item.unitCost.toFixed(2)} = ${(item.quantity * item.unitCost).toFixed(2)}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {item.quantity.toFixed(2)} {item.unitAbbreviation} × ${item.unitCost.toFixed(2)} = ${(item.quantity * item.unitCost).toFixed(2)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="border-t border-[var(--color-border)] pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--color-text-secondary)]">Items:</span>
                    <span className="font-medium text-[var(--color-text-primary)]">{items.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--color-text-secondary)]">Subtotal:</span>
                    <span className="font-medium text-[var(--color-text-primary)]">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-[var(--color-border)] pt-3 text-base font-semibold">
                    <span>Total:</span>
                    <span className="text-[var(--color-success)]">${total.toFixed(2)}</span>
                  </div>
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
                className="w-full rounded-t-lg bg-[var(--color-surface)] p-6 sm:w-auto sm:rounded-lg"
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
              >
                <h3 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">
                  Confirmar creación de compra
                </h3>
                <p className="mb-6 text-[var(--color-text-secondary)]">
                  Vas a crear una compra con {items.length} item(s) por un total de{' '}
                  <strong>${total.toFixed(2)}</strong>
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsConfirming(false)}
                    disabled={isCreating}
                    className="flex-1 rounded-lg border border-[var(--color-border)] px-4 py-2 text-[var(--color-text-primary)] font-medium transition-colors hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmCreate}
                    disabled={isCreating}
                    className="flex-1 rounded-lg bg-[var(--color-success)] px-4 py-2 text-white font-medium transition-colors hover:bg-[var(--color-success)] disabled:opacity-50"
                  >
                    {isCreating ? 'Creando...' : 'Confirmar'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ingredient Creation Modal */}
        <IngredientFormModal
          isOpen={isIngredientModalOpen}
          onClose={() => setIsIngredientModalOpen(false)}
          onSuccess={handleIngredientCreated}
          initialName={ingredientSearch}
        />

        {/* Supplier Creation Modal */}
        <SupplierFormModal
          isOpen={isSupplierModalOpen}
          onClose={() => setIsSupplierModalOpen(false)}
          onSuccess={handleSupplierCreated}
          initialName={supplierSearch}
        />
      </div>
    </motion.div>
  )
}
