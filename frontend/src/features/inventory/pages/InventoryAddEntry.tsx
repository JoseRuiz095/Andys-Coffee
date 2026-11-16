import { useState, useMemo } from 'react'
import { PermissionNotice } from '../../../shared/components/PermissionNotice'
import { navigateTo } from '../../../app/navigation'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { sileo } from 'sileo'
import { Skeleton } from '../../../shared/components/Skeleton'
import { PencilIcon } from '../../../components/ui/PencilIcon'
import { XIcon } from '../../../components/ui/XIcon'
import { useCreatePurchase, useSearchSuppliers } from '../hooks/usePurchases'
import { useSearchIngredients } from '../hooks/useInventory'
import { IngredientFormModal } from '../components/IngredientFormModal'
import { SupplierFormModal } from '../components/SupplierFormModal'
import { getCompatibleUnits } from '../utils/unitConversion'
import { buildPurchaseLine, getEditableValues, toPurchaseItemPayload, type PurchaseLine } from '../utils/purchaseLine'
import { getErrorMessage } from '../../../shared/utils/errors'
import type { InventoryIngredient } from '../api/inventory.api'
import type { Supplier } from '../api/purchases.api'
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue'
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import { useCurrentUser } from '../../auth/hooks/useCurrentUser'
import { useSessionState } from '../../../shared/hooks/useSessionState'
import { PageHeader } from '../../../shared/components/PageHeader'

const TAILWIND_INPUT_CLASS =
  'w-full rounded-lg border border-[var(--color-border)] px-3 py-2 transition-colors focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 bg-[var(--color-input-bg)] text-[var(--color-input-text)]'

type SelectedIngredient = Pick<InventoryIngredient, 'id' | 'name'> & { unit: { abbreviation: string } }


export function InventoryAddEntry() {
  const user = useCurrentUser()
  const canCreateEntry = user?.permissions?.includes('inventory.create_entry') ?? false
  const canCreateIngredient = user?.permissions?.includes('inventory.create_ingredient') ?? false
  const canManageSuppliers = user?.permissions?.includes('inventory.manage_suppliers') ?? false

  // The purchase being captured survives switching tabs or reloading (per user), like the POS cart.
  const draftKey = (field: string) => `andy-purchase-draft:${user?.id ?? 'anon'}:${field}`
  const [supplierId, setSupplier] = useSessionState(draftKey('supplierId'), '')
  const [notes, setNotes] = useSessionState(draftKey('notes'), '')
  const [showNotes, setShowNotes] = useState(false)
  const [items, setItems] = useSessionState<PurchaseLine[]>(draftKey('items'), [])
  const [selectedIngredient, setSelectedIngredient] = useState('')
  // Only id, name and unit are needed; rows restored from a draft purchase carry just those.
  const [selectedIngredientData, setSelectedIngredientData] = useState<SelectedIngredient | null>(null)
  const [captureUnit, setCaptureUnit] = useState('')
  const [itemQuantity, setItemQuantity] = useState('')
  const [itemCost, setItemCost] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [isIngredientModalOpen, setIsIngredientModalOpen] = useState(false)
  const [supplierSearch, setSupplierSearch] = useState('')
  const [showSupplierResults, setShowSupplierResults] = useState(false)
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)
  const [selectedSupplierData, setSelectedSupplierData] = useSessionState<Supplier | null>(draftKey('supplier'), null)

  // Debounce de las búsquedas para no disparar una petición por cada tecla
  const debouncedIngredientSearch = useDebouncedValue(ingredientSearch, 300)
  const debouncedSupplierSearch = useDebouncedValue(supplierSearch, 300)

  // Búsqueda dinámica de ingredientes
  const { data: searchResults, isLoading: isSearching } = useSearchIngredients(debouncedIngredientSearch)

  // Búsqueda dinámica de proveedores
  const { data: supplierResults, isLoading: isSearchingSuppliers } = useSearchSuppliers(debouncedSupplierSearch)

  const { mutate: createPurchase, isPending: isCreating } = useCreatePurchase()

  // Filtrar resultados de búsqueda
  const filteredSearchResults = useMemo(() => {
    if (!searchResults) return []
    return searchResults.filter((ing) => ing.id !== selectedIngredient)
  }, [searchResults, selectedIngredient])

  const handleAddItem = () => {
    if (!selectedIngredient || !selectedIngredientData || !itemQuantity || !itemCost) {
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

    // `cost` is the TOTAL paid for the line ("Costo Total"); the line keeps it as typed and
    // stores quantity and unit cost in the ingredient's base unit.
    const baseUnit = selectedIngredientData.unit.abbreviation
    let newItem: PurchaseLine
    try {
      newItem = buildPurchaseLine({
        ingredientId: selectedIngredient,
        ingredientName: selectedIngredientData.name,
        baseUnit,
        captureUnit,
        quantity: qty,
        totalCost: cost,
      })
    } catch {
      sileo.error({
        title: 'Error de conversión',
        description: `No se puede convertir de ${captureUnit} a ${baseUnit}`,
      })
      return
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

  const handleIngredientCreated = (ingredient: InventoryIngredient) => {
    setIsIngredientModalOpen(false)
    // Same as picking it from the search: the line needs its data and base unit to be added.
    setSelectedIngredient(ingredient.id)
    setSelectedIngredientData(ingredient)
    setCaptureUnit(ingredient.unit.abbreviation)
    setIngredientSearch('')
    setShowSearchResults(false)
  }

  const handleSupplierCreated = (supplier: Supplier) => {
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
        items: items.map(toPurchaseItemPayload),
      },
      {
        onSuccess: (data) => {
          sileo.success({
            title: 'Compra creada correctamente.',
            description: data?.purchase?.invoiceNumber ? `Factura: ${data.purchase.invoiceNumber}` : undefined,
            duration: 3000
          })
          setSupplier('')
          setSelectedSupplierData(null)
          setNotes('')
          setItems([])
          setIsConfirming(false)
          setEditingIndex(null)
        },
        onError: (error: unknown) => {
          sileo.error({
            title: 'Error creando compra',
            description: getErrorMessage(error, 'Intenta de nuevo'),
          })
        },
      }
    )
  }

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
  const total = subtotal

  return (
    <div
     
    >
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <PageHeader title="Nueva compra" description="Registra la mercancía comprada; se suma al inventario al recibirla en Por recibir." />

        {!canCreateEntry && (
          <PermissionNotice action="registrar compras">
            <button type="button" onClick={() => navigateTo('/dashboard?view=inventario&inv=entries')} className="font-medium underline underline-offset-2" style={{ color: 'var(--color-primary)' }}>
              Ver compras por recibir
            </button>
          </PermissionNotice>
        )}

        {canCreateEntry && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Formulario */}
          <div
            className="lg:col-span-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
          >
            <>
            {/* Información general */}
            <h2 className="mb-3 text-base font-semibold text-[var(--color-text-primary)]">1. Proveedor <span className="font-normal text-[var(--color-text-secondary)]">(opcional)</span></h2>
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Proveedor - Búsqueda dinámica */}
              <div className="relative">
                <label htmlFor="inv-addentry-proveedor-opcional" className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">
                  Proveedor (opcional)
                </label>
                <div className="relative">
                  <input
                    id="inv-addentry-proveedor-opcional"
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
                      aria-label="Quitar proveedor seleccionado"
                      onClick={() => {
                        setSupplier('')
                        setSupplierSearch('')
                        setShowSupplierResults(false)
                        setSelectedSupplierData(null)
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]"
                      type="button"
                    >
                      ✕
                    </button>
                  )}
                </div>

                                  {showSupplierResults && !supplierId && (debouncedSupplierSearch.length >= 2 || supplierResults?.length || 0 > 0) && (
                    <div
                      className="absolute top-full left-0 right-0 z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg"
                    >
                      {isSearchingSuppliers ? (
                        <div className="p-3">
                          <Skeleton className="h-8" />
                        </div>
                      ) : supplierResults && supplierResults.length > 0 ? (
                        <div className="divide-y divide-[var(--color-border)]">
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
                                <p className="text-sm text-[var(--color-text-secondary)]">
                                  {supplier.phone}
                                  {supplier.phone && supplier.email ? ' · ' : ''}
                                  {supplier.email}
                                </p>
                              )}
                            </button>
                          ))}
                        </div>
                      ) : debouncedSupplierSearch.length >= 2 ? (
                        <div className="divide-y divide-[var(--color-border)]">
                          <div className="p-3 text-center text-sm text-[var(--color-text-secondary)]">
                            No encontramos proveedores
                          </div>
                          {canManageSuppliers && (
                            <button
                              onClick={() => {
                                setIsSupplierModalOpen(true)
                                setShowSupplierResults(false)
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-[color-mix(in_srgb,var(--color-info)_10%,var(--color-surface))] transition-colors text-[var(--color-info)] font-medium"
                              type="button"
                            >
                              + Crear "{supplierSearch}"
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                              </div>

            </div>

            {/* Items */}
            <h2 className="mb-3 text-base font-semibold text-[var(--color-text-primary)]">2. Insumos</h2>
            <div className="mb-6 space-y-4 rounded-lg bg-[var(--color-surface-hover)] p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* Ingrediente - Búsqueda dinámica */}
                <div className="relative">
                  <label htmlFor="inv-addentry-ingrediente" className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">
                    Ingrediente
                  </label>
                  <div className="relative">
                    <input
                      id="inv-addentry-ingrediente"
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
                        aria-label="Quitar ingrediente seleccionado"
                        onClick={() => {
                          setSelectedIngredient('')
                          setSelectedIngredientData(null)
                          setIngredientSearch('')
                          setShowSearchResults(false)
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]"
                        type="button"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                                      {showSearchResults && !selectedIngredient && (debouncedIngredientSearch.length >= 2 || filteredSearchResults.length > 0) && (
                      <div
                        className="absolute top-full left-0 right-0 z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg"
                      >
                        {isSearching ? (
                          <div className="p-3">
                            <Skeleton className="h-8" />
                          </div>
                        ) : filteredSearchResults.length > 0 ? (
                          <div className="divide-y divide-[var(--color-border)]">
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
                                <p className="text-sm text-[var(--color-text-secondary)]">
                                  {Number(ingredient.currentStock).toFixed(2)} {ingredient.unit.abbreviation}
                                </p>
                              </button>
                            ))}
                          </div>
                        ) : debouncedIngredientSearch.length >= 2 ? (
                          <div className="divide-y divide-[var(--color-border)]">
                            <div className="p-3 text-center text-sm text-[var(--color-text-secondary)]">
                              No encontramos ingredientes exactos
                            </div>
                            {canCreateIngredient && (
                              <button
                                onClick={() => {
                                  setIsIngredientModalOpen(true)
                                  setShowSearchResults(false)
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-[color-mix(in_srgb,var(--color-info)_10%,var(--color-surface))] transition-colors text-[var(--color-info)] font-medium"
                                type="button"
                              >
                                + Crear "{ingredientSearch}"
                              </button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    )}
                                  </div>

                {/* Cantidad */}
                <div>
                  <label htmlFor="inv-addentry-cantidad" className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">
                    Cantidad
                  </label>
                  <div className="flex gap-2 items-stretch">
                    <input
                      id="inv-addentry-cantidad"
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
                  <label htmlFor="inv-addentry-costo-total" className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">
                    Costo Total
                  </label>
                  <input
                    id="inv-addentry-costo-total"
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

                let conversionInfo = null;
                if (captureUnit && captureUnit !== baseUnit) {
                  try {
                    const line = buildPurchaseLine({ ingredientId: selectedIngredientData.id, baseUnit, captureUnit, quantity: qty, totalCost });
                    conversionInfo = {
                      capturedQty: qty,
                      capturedUnit: captureUnit,
                      convertedQty: line.quantity,
                      baseUnit: baseUnit,
                      convertedCost: line.unitCost,
                    };
                  } catch {
                    // Incompatible units: "Agregar" reports it; the preview just omits the conversion.
                  }
                }

                return (
                  <div
                    className="mt-4 rounded-lg bg-[var(--color-surface-hover)] p-3"
                  >
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      Subtotal: <span className="text-[var(--color-success)]">{formatCurrency(totalCost)}</span>
                    </p>
                    {conversionInfo && (
                      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                        ({conversionInfo.capturedQty} {conversionInfo.capturedUnit} → {conversionInfo.convertedQty.toFixed(4)} {conversionInfo.baseUnit})
                      </p>
                    )}
                  </div>
                );
              })()}

              <button
                onClick={handleAddItem}
                disabled={!selectedIngredient || !itemQuantity || !itemCost}
                className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-2 text-[var(--color-button-text)] font-medium transition-colors hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {editingIndex !== null ? 'Actualizar item' : 'Agregar item'}
              </button>
            </div>

            {/* Notas (opcional): collapsed until needed, open when the draft already has them */}
            <div className="mb-6">
              {showNotes || notes ? (
                <>
                  <label htmlFor="inv-addentry-notas-opcional" className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">
                    Notas (opcional)
                  </label>
                  <textarea
                    id="inv-addentry-notas-opcional"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notas sobre la compra..."
                    maxLength={500}
                    rows={3}
                    className={`${TAILWIND_INPUT_CLASS} resize-none`}
                  />
                </>
              ) : (
                <button type="button" onClick={() => setShowNotes(true)} className="text-sm font-medium text-[var(--color-primary)] hover:underline">
                  + Agregar notas
                </button>
              )}
            </div>

            {/* Botón crear */}
            <button
              onClick={() => setIsConfirming(true)}
              disabled={items.length === 0 || isCreating}
              className="w-full rounded-lg bg-[var(--color-success)] px-4 py-2 text-[var(--color-button-text)] font-medium transition-colors hover:bg-[var(--color-success-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreating ? 'Creando compra...' : 'Crear compra'}
            </button>
            </>
          </div>

          {/* Resumen */}
          <div
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
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
                      className={`rounded-lg p-3 ${editingIndex === i ? 'bg-[color-mix(in_srgb,var(--color-info)_10%,var(--color-surface))] border border-[color-mix(in_srgb,var(--color-info)_35%,var(--color-border))]' : 'bg-[var(--color-surface-hover)]'}`}
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
                                name: item.ingredientName ?? '',
                                unit: { abbreviation: item.unitAbbreviation ?? '' }
                              })
                              const editable = getEditableValues(item)
                              setItemQuantity(editable.quantity.toString())
                              setItemCost(editable.totalCost.toString())
                              setCaptureUnit(editable.captureUnit)
                              setEditingIndex(i)
                            }}
                            className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-info)] hover:bg-[color-mix(in_srgb,var(--color-info)_10%,var(--color-surface))] rounded transition-colors"
                            type="button"
                            title="Editar"
                            aria-label="Editar"
                          >
                            <PencilIcon size={16} />
                          </button>
                          <button
                            onClick={() => handleRemoveItem(i)}
                            className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,var(--color-surface))] rounded transition-colors"
                            type="button"
                            title="Eliminar"
                            aria-label="Eliminar"
                          >
                            <XIcon size={16} />
                          </button>
                        </div>
                      </div>
                      {item.captureUnit && item.captureUnit !== item.unitAbbreviation ? (
                        <div className="text-sm text-[var(--color-text-secondary)] space-y-1">
                          <p>
                            Capturado: {(item.capturedQuantity ?? 0).toFixed(2)} {item.captureUnit} × {formatCurrency((item.capturedQuantity ? (item.capturedTotalCost ?? 0) / item.capturedQuantity : 0))} = {formatCurrency((item.capturedTotalCost ?? 0))}
                          </p>
                          <p>
                            Convertido: {item.quantity.toFixed(2)} {item.unitAbbreviation} × {formatCurrency(item.unitCost)} = {formatCurrency((item.quantity * item.unitCost))}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          {item.quantity.toFixed(2)} {item.unitAbbreviation} × {formatCurrency(item.unitCost)} = {formatCurrency((item.quantity * item.unitCost))}
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
                    <span className="font-medium text-[var(--color-text-primary)]">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between border-t border-[var(--color-border)] pt-3 text-base font-semibold">
                    <span>Total:</span>
                    <span className="text-[var(--color-success)]">{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        <ConfirmDialog
          isOpen={isConfirming}
          title="Confirmar creación de compra"
          message={`Vas a crear una compra con ${items.length} item(s) por un total de ${formatCurrency(total)}.`}
          confirmText="Confirmar"
          isLoading={isCreating}
          onConfirm={handleConfirmCreate}
          onCancel={() => setIsConfirming(false)}
        />

        {/* Ingredient Creation Modal */}
        {isIngredientModalOpen && (
        <IngredientFormModal
          isOpen
          onClose={() => setIsIngredientModalOpen(false)}
          onSuccess={handleIngredientCreated}
          initialName={ingredientSearch}
        />
        )}

        {/* Supplier Creation Modal */}
        {isSupplierModalOpen && (
        <SupplierFormModal
          isOpen
          onClose={() => setIsSupplierModalOpen(false)}
          onSuccess={handleSupplierCreated}
          initialName={supplierSearch}
        />
        )}
      </div>
    </div>
  )
}
