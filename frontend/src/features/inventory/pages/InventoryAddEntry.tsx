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
import { buildPurchaseLine, getEditableValues, purchaseLineProblem, toPurchaseItemPayload, type PurchaseLine } from '../utils/purchaseLine'
import { getErrorMessage } from '../../../shared/utils/errors'
import type { InventoryIngredient } from '../api/inventory.api'
import type { Supplier } from '../api/purchases.api'
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue'
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import { useCurrentUser } from '../../auth/hooks/useCurrentUser'
import { useSessionState } from '../../../shared/hooks/useSessionState'
import { PageHeader } from '../../../shared/components/PageHeader'
import { FORM_CONTROL_CLASS, FORM_FIELD_CLASS, FORM_LABEL_CLASS } from '../../../shared/constants/fieldStyles'
import { ACTION_LINK_CLASS, ACTION_PRIMARY_CLASS, ACTION_SUCCESS_CLASS } from '../../../shared/constants/actionStyles'

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
        description: 'Selecciona ingrediente, cantidad y costo total.',
      })
      return
    }

    const qty = parseFloat(itemQuantity)
    const cost = parseFloat(itemCost)

    // A cost of 0 is allowed (samples or gifts from the supplier), like the API accepts.
    if (!Number.isFinite(qty) || !Number.isFinite(cost) || qty <= 0 || cost < 0) {
      sileo.error({
        title: 'Valores inválidos',
        description: 'La cantidad debe ser mayor a cero y el costo no puede ser negativo.',
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

    const problem = purchaseLineProblem(newItem)
    if (problem) {
      sileo.error({ title: 'Renglón no válido', description: problem })
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


  const startEditing = (item: PurchaseLine, index: number) => {
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
    setEditingIndex(index)
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Nueva compra" description="Registra la mercancía comprada; se suma al inventario al recibirla en Por recibir." />

      {!canCreateEntry && (
        <PermissionNotice action="registrar compras">
          <button type="button" onClick={() => navigateTo('/dashboard?view=inventario&inv=entries')} className="font-medium underline underline-offset-2" style={{ color: 'var(--color-primary)' }}>
            Ver compras por recibir
          </button>
        </PermissionNotice>
      )}

      {canCreateEntry && (
      // Form on the left, the purchase being built on the right (it follows the scroll on lg+),
      // with "Crear compra" right under the total it confirms.
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <div className="space-y-4">
          {/* 1. Proveedor y notas */}
          <section aria-labelledby="addentry-supplier-title" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <h2 id="addentry-supplier-title" className="mb-3 text-base font-semibold text-[var(--color-text-primary)]">1. Proveedor y notas</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Proveedor - Búsqueda dinámica */}
              <div className="relative">
                <label htmlFor="inv-addentry-proveedor-opcional" className={FORM_LABEL_CLASS}>
                  Proveedor <span className="font-normal text-[var(--color-text-secondary)]">(opcional)</span>
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
                    className={`${FORM_FIELD_CLASS} pr-10`}
                  />

                  {supplierId && (
                    <button
                      aria-label="Quitar proveedor seleccionado"
                      title="Quitar proveedor"
                      onClick={() => {
                        setSupplier('')
                        setSupplierSearch('')
                        setShowSupplierResults(false)
                        setSelectedSupplierData(null)
                      }}
                      className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                      type="button"
                    >
                      <XIcon size={16} />
                    </button>
                  )}
                </div>

                {showSupplierResults && !supplierId && (debouncedSupplierSearch.length >= 2 || supplierResults?.length || 0 > 0) && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg">
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
                            className="w-full px-3 py-2 text-left transition-colors hover:bg-[var(--color-surface-hover)]"
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
                            className="w-full px-3 py-2 text-left font-medium text-[var(--color-info)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-info)_10%,var(--color-surface))]"
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

              {/* Notas (opcional): collapsed until needed, open when the draft already has them */}
              <div>
                {showNotes || notes ? (
                  <>
                    <label htmlFor="inv-addentry-notas-opcional" className={FORM_LABEL_CLASS}>
                      Notas <span className="font-normal text-[var(--color-text-secondary)]">(opcional)</span>
                    </label>
                    <textarea
                      id="inv-addentry-notas-opcional"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Notas sobre la compra..."
                      maxLength={500}
                      rows={2}
                      className={`${FORM_FIELD_CLASS} resize-none`}
                    />
                  </>
                ) : (
                  <div className="md:pt-6">
                    <button type="button" onClick={() => setShowNotes(true)} className={`${ACTION_LINK_CLASS} text-sm`}>
                      + Agregar notas
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 2. Insumos: one line per ingredient, "Agregar item" at the end of the same row. */}
          <section
            aria-labelledby="addentry-items-title"
            className="rounded-lg border bg-[var(--color-surface)] p-4"
            style={{ borderColor: editingIndex !== null ? 'var(--color-info)' : 'var(--color-border)' }}
          >
            <h2 id="addentry-items-title" className="mb-3 text-base font-semibold text-[var(--color-text-primary)]">
              2. Insumos
              {editingIndex !== null && <span className="ml-2 text-sm font-medium text-[var(--color-info)]">Editando renglón {editingIndex + 1}</span>}
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto] xl:items-end">
              {/* Ingrediente - Búsqueda dinámica */}
              <div className="relative">
                <label htmlFor="inv-addentry-ingrediente" className={FORM_LABEL_CLASS}>
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
                    className={`${FORM_FIELD_CLASS} pr-10`}
                  />

                  {selectedIngredient && (
                    <button
                      aria-label="Quitar ingrediente seleccionado"
                      title="Quitar ingrediente"
                      onClick={() => {
                        setSelectedIngredient('')
                        setSelectedIngredientData(null)
                        setIngredientSearch('')
                        setShowSearchResults(false)
                      }}
                      className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                      type="button"
                    >
                      <XIcon size={16} />
                    </button>
                  )}
                </div>

                {showSearchResults && !selectedIngredient && (debouncedIngredientSearch.length >= 2 || filteredSearchResults.length > 0) && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg">
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
                            className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--color-surface-hover)]"
                            type="button"
                          >
                            <span className="min-w-0 text-sm font-medium text-[var(--color-text-primary)]">
                              {ingredient.name}
                              {ingredient.sku && (
                                <span className="ml-1 font-normal text-[var(--color-text-secondary)]">({ingredient.sku})</span>
                              )}
                            </span>
                            <span className="shrink-0 text-sm tabular-nums text-[var(--color-text-secondary)]">
                              {Number(ingredient.currentStock).toFixed(2)} {ingredient.unit.abbreviation}
                            </span>
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
                            className="w-full px-3 py-2 text-left font-medium text-[var(--color-info)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-info)_10%,var(--color-surface))]"
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
                <label htmlFor="inv-addentry-cantidad" className={FORM_LABEL_CLASS}>
                  Cantidad
                </label>
                <div className="flex items-stretch gap-2">
                  <input
                    id="inv-addentry-cantidad"
                    type="number"
                    step="0.01"
                    min="0"
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(e.target.value)}
                    placeholder="0.00"
                    className={`${FORM_CONTROL_CLASS} w-0 min-w-0 flex-1 tabular-nums`}
                  />
                  {selectedIngredientData && (
                    <select
                      value={captureUnit}
                      onChange={(e) => setCaptureUnit(e.target.value)}
                      aria-label="Unidad de la cantidad"
                      className={`${FORM_CONTROL_CLASS} w-20 shrink-0 px-2`}
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
                <label htmlFor="inv-addentry-costo-total" className={FORM_LABEL_CLASS}>
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
                  className={`${FORM_FIELD_CLASS} tabular-nums`}
                />
              </div>

              <div className="flex text-sm md:col-span-3 md:justify-end xl:col-span-1">
                <button
                  onClick={handleAddItem}
                  disabled={!selectedIngredient || !itemQuantity || !itemCost}
                  className={`${ACTION_PRIMARY_CLASS} w-full md:w-auto`}
                  type="button"
                >
                  {editingIndex !== null ? 'Actualizar item' : 'Agregar item'}
                </button>
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
                <p className="mt-3 rounded-lg bg-[var(--color-surface-hover)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                  <span className="font-medium text-[var(--color-text-primary)]">Subtotal: </span>
                  <span className="font-semibold tabular-nums text-[var(--color-success)]">{formatCurrency(totalCost)}</span>
                  {conversionInfo && (
                    <span className="ml-2 tabular-nums">
                      ({conversionInfo.capturedQty} {conversionInfo.capturedUnit} → {conversionInfo.convertedQty.toFixed(4)} {conversionInfo.baseUnit})
                    </span>
                  )}
                </p>
              );
            })()}
          </section>
        </div>

        {/* Resumen */}
        <aside
          aria-labelledby="addentry-summary-title"
          className="flex flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] lg:sticky lg:top-16"
        >
          <h2 id="addentry-summary-title" className="border-b border-[var(--color-border)] px-4 py-3 text-base font-semibold text-[var(--color-text-primary)]">
            Resumen <span className="font-normal text-[var(--color-text-secondary)]">({items.length} items)</span>
          </h2>

          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[var(--color-text-secondary)]">
              Sin items agregados. Busca un ingrediente y agrégalo con su cantidad y costo.
            </p>
          ) : (
            <ul className="max-h-[50vh] divide-y divide-[var(--color-border)] overflow-y-auto">
              {items.map((item, i) => (
                <li
                  key={i}
                  className="px-4 py-2.5"
                  style={editingIndex === i ? { backgroundColor: 'color-mix(in srgb, var(--color-info) 10%, var(--color-surface))' } : undefined}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 font-medium text-[var(--color-text-primary)]">
                      {item.ingredientName}
                    </p>
                    <span className="shrink-0 font-semibold tabular-nums text-[var(--color-text-primary)]">
                      {formatCurrency(item.quantity * item.unitCost)}
                    </span>
                    <div className="-my-1 flex shrink-0 gap-0.5">
                      <button
                        onClick={() => startEditing(item, i)}
                        className="grid size-8 place-items-center rounded text-[var(--color-text-secondary)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-info)_10%,var(--color-surface))] hover:text-[var(--color-info)]"
                        type="button"
                        title="Editar"
                        aria-label="Editar"
                      >
                        <PencilIcon size={16} />
                      </button>
                      <button
                        onClick={() => handleRemoveItem(i)}
                        className="grid size-8 place-items-center rounded text-[var(--color-text-secondary)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,var(--color-surface))] hover:text-[var(--color-danger)]"
                        type="button"
                        title="Eliminar"
                        aria-label="Eliminar"
                      >
                        <XIcon size={16} />
                      </button>
                    </div>
                  </div>
                  {item.captureUnit && item.captureUnit !== item.unitAbbreviation ? (
                    <div className="space-y-0.5 text-sm tabular-nums text-[var(--color-text-secondary)]">
                      <p>
                        Capturado: {(item.capturedQuantity ?? 0).toFixed(2)} {item.captureUnit} × {formatCurrency((item.capturedQuantity ? (item.capturedTotalCost ?? 0) / item.capturedQuantity : 0))} = {formatCurrency((item.capturedTotalCost ?? 0))}
                      </p>
                      <p>
                        Convertido: {item.quantity.toFixed(2)} {item.unitAbbreviation} × {formatCurrency(item.unitCost)} = {formatCurrency((item.quantity * item.unitCost))}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm tabular-nums text-[var(--color-text-secondary)]">
                      {item.quantity.toFixed(2)} {item.unitAbbreviation} × {formatCurrency(item.unitCost)} = {formatCurrency((item.quantity * item.unitCost))}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2 border-t border-[var(--color-border)] px-4 py-3">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--color-text-secondary)]">Subtotal</span>
              <span className="font-medium tabular-nums text-[var(--color-text-primary)]">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-baseline justify-between text-[var(--color-text-primary)]">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold tabular-nums text-[var(--color-success)]">{formatCurrency(total)}</span>
            </div>
            <div className="pt-1 text-sm">
              <button
                onClick={() => setIsConfirming(true)}
                disabled={items.length === 0 || isCreating}
                className={`${ACTION_SUCCESS_CLASS} w-full`}
                type="button"
              >
                {isCreating ? 'Creando compra...' : 'Crear compra'}
              </button>
            </div>
          </div>
        </aside>
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
  )
}
