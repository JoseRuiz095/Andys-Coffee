import { useState } from 'react'
import { useProducts, useCategories, useProductDetail, useProductImage, useProductFamilies } from '../../../products/hooks/useProducts'
import { ProductRecipeSection } from '../../../products/components/ProductRecipeSection'
import type { ProductRecipeDraft } from '../../../products/types/recipe.types'
import { EMPTY_PRODUCT_RECIPE, recipeCost, recipeRowsError, rowsFromRecipe, rowsToInput } from '../../../products/utils/recipeDraft'
import { useInventoryUnits } from '../../hooks/useInventory'
import { useImageDraft } from '../../../products/hooks/useImageDraft'
import { ProductImageField } from '../../../products/components/ProductImageField'
import { useExtras } from '../../../extras/hooks/useExtras'
import { useCurrentUser } from '../../../auth/hooks/useCurrentUser'
import { hasPermission } from '../../../auth/utils/permissions'
import { ConfirmDialog } from '../../../../shared/components/ConfirmDialog'
import { Modal } from '../../../../shared/components/Modal'
import { formatCurrency } from '../../../../shared/utils/formatCurrency'
import { getErrorMessage } from '../../../../shared/utils/errors'
import { CategoryManagerModal } from '../CategoryManagerModal'
import { sileo } from 'sileo'
import type { CreateProductInput, ProductVariantOption, UpdateProductInput } from '../../../products/types/product.types'
import type { Product } from '../../../products/types/product.types'
import { formatDrinkTemperature, getDrinkTemperature } from '../../../../shared/utils/productTemperature'
import type { ProductTemperature } from '../../../../shared/utils/productTemperature'
import { Pagination } from '../../../../shared/components/Pagination'
import { ProductsTable } from './ProductsTable'
import { PageHeader } from '../../../../shared/components/PageHeader'
import { FilterBar } from '../../../../shared/components/FilterBar'
import { FILTER_FIELD_CLASS } from '../../../../shared/constants/fieldStyles'

export function ProductsTab() {
  const currentUser = useCurrentUser()
  const {
    products,
    loading,
    error,
    page,
    setPage,
    totalPages,
    total,
    pageSize,
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    statusFilter,
    setStatusFilter,
    createAsync,
    updateAsync,
    deleteAsync,
    setActive,
    isCreating,
    isUpdating,
    isDeleting,
    togglingProductId,
  } = useProducts()
  const { categories } = useCategories()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const { data: editingDetail } = useProductDetail(editingProduct?.id)
  const { data: units } = useInventoryUnits()
  const { families, createAsync: createFamilyAsync, isCreating: isCreatingFamily } = useProductFamilies(isCreateModalOpen)
  const canManageRecipes = hasPermission(currentUser, 'inventory.manage_recipes')
  // Extras, recipe, family and options are saved together with the product (one request).
  const { data: allExtras = [] } = useExtras(isCreateModalOpen)
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([])
  const [recipeDraft, setRecipeDraft] = useState<ProductRecipeDraft>(EMPTY_PRODUCT_RECIPE)
  const [tracksInventory, setTracksInventory] = useState(true)
  const [familyId, setFamilyId] = useState<string>('')
  const [variantLabel, setVariantLabel] = useState('')
  const [options, setOptions] = useState<ProductVariantOption[]>([])
  const [showSaleOptions, setShowSaleOptions] = useState(false)
  // Products that already use a family, options or extras show the section open (nothing hidden).
  const hasSaleOptions = Boolean(familyId) || options.length > 0 || selectedExtraIds.length > 0
  const isSaleOptionsOpen = showSaleOptions || hasSaleOptions
  const [newFamilyName, setNewFamilyName] = useState('')
  // The detail (recipe, extras, options) loaded into the form; until then an edit can't be saved.
  const [detailLoadedFor, setDetailLoadedFor] = useState<string | null>(null)
  if (editingDetail && editingDetail.id === editingProduct?.id && detailLoadedFor !== editingDetail.id) {
    setDetailLoadedFor(editingDetail.id)
    setSelectedExtraIds((editingDetail.extras ?? []).map(({ extraId }) => extraId))
    setRecipeDraft({ REGULAR: rowsFromRecipe(editingDetail.recipe?.REGULAR), JUMBO: rowsFromRecipe(editingDetail.recipe?.JUMBO) })
    setTracksInventory(editingDetail.tracksInventory ?? true)
    setFamilyId(editingDetail.familyId ?? '')
    setVariantLabel(editingDetail.variantLabel ?? '')
    setOptions(editingDetail.options ?? [])
  }
  const detailReady = !editingProduct || detailLoadedFor === editingProduct.id
  const toggleExtra = (extraId: string) =>
    setSelectedExtraIds((current) => (current.includes(extraId) ? current.filter((id) => id !== extraId) : [...current, extraId]))
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<string | null>(null)
  // Deactivating hides the product from the POS menu: it is confirmed first.
  const [productToDeactivate, setProductToDeactivate] = useState<Product | null>(null)

  // Product photo: picked locally (preview), then uploaded and converted to WebP by the API.
  const productImage = useProductImage()
  const imageDraft = useImageDraft()
  // Server result shown right away, before the refetched product arrives.
  const [imageOverride, setImageOverride] = useState<{ productId: string; url: string | null } | null>(null)
  const [removeImageConfirmOpen, setRemoveImageConfirmOpen] = useState(false)
  const currentImageUrl = editingProduct
    ? imageOverride?.productId === editingProduct.id
      ? imageOverride.url
      : editingDetail?.imageUrl ?? editingProduct.imageUrl ?? null
    : null

  const resetImageState = () => {
    imageDraft.clear()
    setImageOverride(null)
    setRemoveImageConfirmOpen(false)
  }

  const uploadDraft = async (productId: string, file: File) => {
    const result = await productImage.uploadAsync({ productId, file })
    setImageOverride({ productId, url: result.imageUrl })
    imageDraft.clear()
    return result
  }

  const handleConfirmImage = async () => {
    if (!editingProduct || !imageDraft.draft) return
    try {
      const result = await uploadDraft(editingProduct.id, imageDraft.draft.file)
      sileo.success({
        title: 'Imagen actualizada',
        description: `Optimizada a WebP: ${Math.round(result.bytes / 1024)} KB (original ${Math.round(result.originalBytes / 1024)} KB).`,
      })
    } catch (error) {
      // The previous image stays on the server; the preview stays so the user can retry or cancel.
      const message = getErrorMessage(error, 'No se pudo subir la imagen.')
      imageDraft.setError(message)
      sileo.error({ title: 'No se pudo subir la imagen', description: message })
    }
  }

  const handleRemoveImage = async () => {
    if (!editingProduct) return
    try {
      await productImage.removeAsync(editingProduct.id)
      setImageOverride({ productId: editingProduct.id, url: null })
      sileo.success({ title: 'Imagen eliminada', description: 'El producto ahora muestra la imagen por defecto.' })
    } catch (error) {
      sileo.error({ title: 'No se pudo quitar la imagen', description: getErrorMessage(error, 'Intenta de nuevo.') })
    } finally {
      setRemoveImageConfirmOpen(false)
    }
  }

  /** Upload during save: a failure is reported but does not undo the saved product. */
  const uploadPendingImage = async (productId: string, file: File) => {
    try {
      await uploadDraft(productId, file)
    } catch (error) {
      sileo.error({
        title: 'El producto se guardó, pero la imagen no',
        description: getErrorMessage(error, 'Vuelve a intentarlo desde Editar.'),
      })
    }
  }

  const [formData, setFormData] = useState<CreateProductInput>({
    name: '',
    description: '',
    sku: '',
    price: 0,
    jumboPrice: null,
    cost: 0,
    categoryId: '',
    temperature: null,
    displayOrder: 0,
  })
  // R-04: cost of the regular recipe as it is being edited, offered as the product cost.
  // Sold hot and cold: the hot version's cost (lines marked "Ambas" + "Caliente").
  const suggestedCost = tracksInventory && recipeDraft.REGULAR.length > 0
    ? recipeCost(recipeDraft.REGULAR, units, formData.temperature === 'BOTH' ? 'HOT' : undefined)
    : null

  // Fill (or clear) the form whenever the product being edited changes — adjusted during
  // render instead of in an effect, as recommended by React.
  const [formProduct, setFormProduct] = useState<Product | null>(null)
  if (editingProduct !== formProduct) {
    setFormProduct(editingProduct)
    // Another product (or a new one): its extras, recipe and grouping come from its detail.
    setSelectedExtraIds([])
    setRecipeDraft(EMPTY_PRODUCT_RECIPE)
    setTracksInventory(true)
    setFamilyId('')
    setVariantLabel('')
    setOptions([])
    setNewFamilyName('')
    setShowSaleOptions(false)
    setDetailLoadedFor(null)
    if (editingProduct) {
      setFormData({
        name: editingProduct.name,
        description: editingProduct.description || '',
        sku: editingProduct.sku,
        price: editingProduct.price,
        jumboPrice: editingProduct.jumboPrice ?? null,
        cost: editingProduct.cost,
        categoryId: editingProduct.categoryId || '',
        temperature: editingProduct.temperature ?? getDrinkTemperature(
          editingProduct.name,
          categories.find((category) => category.id === editingProduct.categoryId)?.name,
        ),
        displayOrder: editingProduct.displayOrder,
      })
    } else {
      setFormData({
        name: '',
        description: '',
        sku: '',
        price: 0,
        jumboPrice: null,
        cost: 0,
        categoryId: '',
        temperature: null,
        displayOrder: 0,
      })
    }
  }

  const canCreate = hasPermission(currentUser, 'products.create')
  const canUpdate = hasPermission(currentUser, 'products.update')
  const canDelete = hasPermission(currentUser, 'products.delete')

  const isSaving = isCreating || isUpdating || productImage.isUploading || productImage.isRemoving

  const handleCreateFamily = async () => {
    const name = newFamilyName.trim()
    if (name.length < 2) return
    try {
      const family = await createFamilyAsync({ name, categoryId: formData.categoryId || null })
      setFamilyId(family.id)
      setNewFamilyName('')
    } catch (error) {
      sileo.error({ title: 'No se pudo crear la familia', description: getErrorMessage(error, 'Intenta de nuevo.') })
    }
  }

  /** First reason the recipe can't be saved (decision D-5), or null. */
  const recipeProblem = (): string | null => {
    if (!tracksInventory) return null
    if (recipeDraft.REGULAR.length === 0) {
      return 'Captura la receta (ingredientes y cantidades) o marca "No controla inventario".'
    }
    if (jumboAvailable && recipeDraft.JUMBO.length === 0) return 'El producto tiene precio Jumbo: captura también la receta Jumbo.'
    return recipeRowsError(recipeDraft.REGULAR, false) ?? (jumboAvailable ? recipeRowsError(recipeDraft.JUMBO, false) : null)
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.sku?.trim()) {
      sileo.error({ title: 'Error', description: 'Por favor completa los campos requeridos' })
      return
    }

    // An emptied number field is NaN, which JSON would send as null: reject it here.
    const isAmount = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value) && value >= 0
    if (!isAmount(formData.price) || !isAmount(formData.cost)) {
      sileo.error({ title: 'Revisa los montos', description: 'El precio y el costo deben ser números mayores o iguales a 0.' })
      return
    }
    if (formData.jumboPrice !== null && formData.jumboPrice !== undefined && !isAmount(formData.jumboPrice)) {
      sileo.error({ title: 'Revisa los montos', description: 'El precio Jumbo debe ser un número mayor o igual a 0, o déjalo vacío.' })
      return
    }

    if (isBeverageCategory(formData.categoryId) && !formData.temperature) {
      sileo.error({ title: 'Error', description: 'Selecciona si la bebida es caliente o fría.' })
      return
    }

    // Without the recipes permission the recipe isn't sent (the server keeps the stored one).
    const problem = canManageRecipes ? recipeProblem() : null
    if (problem) {
      sileo.error({ title: 'Receta incompleta', description: problem })
      return
    }

    const payload = {
      ...formData,
      categoryId: formData.categoryId || undefined,
      jumboPrice: isBeverageCategory(formData.categoryId) ? formData.jumboPrice ?? null : null,
      tracksInventory,
      familyId: familyId || null,
      variantLabel: variantLabel.trim() || null,
      options: options.filter((option) => option.name.trim() && option.value.trim()),
      extraIds: selectedExtraIds,
      ...(canManageRecipes && {
        recipe: tracksInventory
          ? { REGULAR: rowsToInput(recipeDraft.REGULAR), ...(jumboAvailable && { JUMBO: rowsToInput(recipeDraft.JUMBO) }) }
          : { REGULAR: [] },
      }),
    }

    try {
      if (editingProduct) {
        await updateAsync({ input: { id: editingProduct.id, ...payload } as UpdateProductInput })
        sileo.success({ title: 'Éxito', description: 'Producto actualizado correctamente' })
        // A photo picked but not confirmed yet is uploaded with the save instead of being lost.
        if (imageDraft.draft) await uploadPendingImage(editingProduct.id, imageDraft.draft.file)
      } else {
        const created = await createAsync({ input: payload })
        sileo.success({ title: 'Éxito', description: 'Producto creado correctamente' })
        // New products need their id before the photo can be uploaded.
        if (imageDraft.draft && created?.id) await uploadPendingImage(created.id, imageDraft.draft.file)
      }
      setSelectedExtraIds([])
      setDetailLoadedFor(null)

      setIsCreateModalOpen(false)
      setEditingProduct(null)
      resetImageState()
    } catch (error) {
      sileo.error({
        title: 'No se pudo guardar el producto',
        description: getErrorMessage(error, 'Intenta de nuevo.'),
      })
    }
  }

  const handleDeleteClick = (productId: string) => {
    setProductToDelete(productId)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (productToDelete) {
      try {
        await deleteAsync(productToDelete)
        sileo.success({ title: 'Éxito', description: 'Producto eliminado correctamente' })
        setDeleteConfirmOpen(false)
        setProductToDelete(null)
      } catch (error) {
        sileo.error({
          title: 'No se pudo eliminar el producto',
          description: getErrorMessage(error, 'Intenta de nuevo.'),
        })
      }
      return
    }
    setDeleteConfirmOpen(false)
    setProductToDelete(null)
  }

  const handleToggleActive = (product: Product) => {
    if (togglingProductId) return
    if (product.isActive) {
      setProductToDeactivate(product)
      return
    }
    setActive({ id: product.id, isActive: true })
  }

  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return 'Sin categoría'
    return categories.find((c) => c.id === categoryId)?.name || 'Desconocida'
  }

  /** Beverages are flagged on their category (temperature and Jumbo size). */
  const isBeverageCategory = (categoryId?: string) => categories.find((c) => c.id === categoryId)?.isBeverage === true

  const jumboAvailable = isBeverageCategory(formData.categoryId) && formData.jumboPrice !== null && formData.jumboPrice !== undefined

  const getProductTemperature = (product: Product): ProductTemperature | null =>
    product.temperature ?? getDrinkTemperature(product.name, getCategoryName(product.categoryId))

  if (error) {
    return (
      <div role="alert" className="rounded-lg border p-4" style={{ borderColor: 'var(--color-danger)', backgroundColor: 'color-mix(in srgb, var(--color-danger) 12%, var(--color-surface))', color: 'var(--color-danger)' }}>
        Error al cargar productos: {getErrorMessage(error, 'revisa tu conexión e inténtalo de nuevo.')}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Productos"
        description="Lo que se vende en el menú del punto de venta."
        actions={
          canCreate && (
            <>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                className="min-h-10 rounded-lg border px-4 text-sm font-medium transition hover:bg-[var(--color-surface-hover)]"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              >
                Categorías
              </button>
              <button
                type="button"
                onClick={() => {
                  resetImageState()
                  setEditingProduct(null)
                  setIsCreateModalOpen(true)
                }}
                className="min-h-10 rounded-lg px-4 text-sm font-semibold text-[var(--color-button-text)] transition hover:bg-[var(--color-primary-hover)]"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                + Nuevo producto
              </button>
            </>
          )
        }
      />

      <FilterBar
        hasFilters={Boolean(search) || categoryFilter !== undefined || statusFilter !== undefined}
        onClear={() => {
          setSearch('')
          setCategoryFilter(undefined)
          setStatusFilter(undefined)
          setPage(1)
        }}
      >
        <input
          type="search"
          placeholder="Nombre o SKU..."
          aria-label="Buscar producto por nombre o SKU"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className={`${FILTER_FIELD_CLASS} w-full sm:w-64`}
        />
        <select
          aria-label="Filtrar por categoría"
          value={categoryFilter || ''}
          onChange={(e) => {
            setCategoryFilter(e.target.value || undefined)
            setPage(1)
          }}
          className={FILTER_FIELD_CLASS}
        >
          <option value="">Todas las categorías</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por estado"
          value={statusFilter === undefined ? '' : statusFilter === true ? 'active' : 'inactive'}
          onChange={(e) => {
            if (e.target.value === '') setStatusFilter(undefined)
            else if (e.target.value === 'active') setStatusFilter(true)
            else setStatusFilter(false)
            setPage(1)
          }}
          className={FILTER_FIELD_CLASS}
        >
          <option value="">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </FilterBar>

      <ProductsTable
        products={products}
        isLoading={loading}
        hasFilters={Boolean(search) || categoryFilter !== undefined || statusFilter !== undefined}
        getCategoryName={getCategoryName}
        getTemperatureLabel={(product) =>
          isBeverageCategory(product.categoryId)
            ? getProductTemperature(product) ? formatDrinkTemperature(getProductTemperature(product)!) : 'Sin definir'
            : null
        }
        canUpdate={canUpdate}
        canDelete={canDelete}
        togglingProductId={togglingProductId}
        deletingProductId={isDeleting ? productToDelete : null}
        onEdit={(product) => {
          resetImageState()
          setEditingProduct(product)
          setIsCreateModalOpen(true)
        }}
        onToggleActive={handleToggleActive}
        onDelete={handleDeleteClick}
      />

      {/* Pagination Footer */}
      {!loading && products.length > 0 && totalPages > 1 && (
        <Pagination
          className="mt-4"
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          itemLabel="productos"
          onPageChange={setPage}
        />
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          if (isSaving) return
          setIsCreateModalOpen(false)
          setEditingProduct(null)
          resetImageState()
        }}
        ariaLabelledBy="product-modal-title"
        maxWidthClassName="max-w-2xl"
      >
            <div className="space-y-4 p-6">
              <h2 id="product-modal-title" className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {editingProduct ? 'Editar Producto' : 'Crear Nuevo Producto'}
              </h2>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>Datos básicos</h3>
                <div>
                  <label htmlFor="productstab-nombre" className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Nombre *
                  </label>
                  <input
                    id="productstab-nombre"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 w-full rounded-lg border px-4 py-2"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
                    placeholder="Nombre del producto"
                  />
                </div>

                <div>
                  <label htmlFor="productstab-sku" className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    SKU *
                  </label>
                  <input
                    id="productstab-sku"
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="mt-1 w-full rounded-lg border px-4 py-2"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
                    placeholder="SKU único"
                  />
                </div>

                <div>
                  <label htmlFor="productstab-descripcion" className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Descripción
                  </label>
                  <textarea
                    id="productstab-descripcion"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-1 w-full rounded-lg border px-4 py-2"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
                    placeholder="Descripción del producto"
                    rows={3}
                  />
                </div>

                <div>
                  <label htmlFor="productstab-categoria-2" className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Categoría
                  </label>
                  <select
                    id="productstab-categoria-2"
                    value={formData.categoryId || ''}
                    onChange={(e) => {
                      const categoryId = e.target.value || undefined
                      setFormData({
                        ...formData,
                        categoryId,
                        temperature: isBeverageCategory(categoryId) ? formData.temperature : null,
                      })
                    }}
                    className="mt-1 w-full rounded-lg border px-4 py-2"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
                  >
                    <option value="">Sin categoría</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {isBeverageCategory(formData.categoryId) && (
                  <fieldset>
                    <legend className="mb-2 block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      Temperatura
                    </legend>
                    <div className="grid grid-cols-2 gap-2">
                      {(['HOT', 'COLD', 'BOTH'] as const).map((temperature) => (
                        <button
                          key={temperature}
                          type="button"
                          aria-pressed={formData.temperature === temperature}
                          onClick={() => setFormData({ ...formData, temperature })}
                          className="rounded-lg border px-4 py-2 font-medium transition-colors"
                          style={{
                            borderColor: formData.temperature === temperature ? 'var(--color-primary)' : 'var(--color-border)',
                            backgroundColor: formData.temperature === temperature ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                            color: 'var(--color-text-primary)',
                          }}
                        >
                          {formatDrinkTemperature(temperature)}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}

                <ProductImageField
                  currentUrl={currentImageUrl}
                  draft={imageDraft.draft}
                  error={imageDraft.error}
                  uploadsOnSave={!editingProduct}
                  disabled={isCreating || isUpdating}
                  isUploading={productImage.isUploading}
                  isRemoving={productImage.isRemoving}
                  onSelect={imageDraft.select}
                  onConfirm={handleConfirmImage}
                  onCancel={imageDraft.clear}
                  onRemove={() => setRemoveImageConfirmOpen(true)}
                />

                <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>Precio y costo</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="productstab-precio" className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      Precio *
                    </label>
                    <input
                      id="productstab-precio"
                      type="number"
                      value={Number.isNaN(formData.price) ? '' : formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                      className="mt-1 w-full rounded-lg border px-4 py-2"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div>
                    <label htmlFor="productstab-costo" className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      Costo *
                    </label>
                    <input
                      id="productstab-costo"
                      type="number"
                      value={Number.isNaN(formData.cost) ? '' : formData.cost}
                      onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) })}
                      className="mt-1 w-full rounded-lg border px-4 py-2"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                    {suggestedCost !== null && (
                      <p className="mt-1 flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        Costo según receta: {formatCurrency(suggestedCost)}
                        {suggestedCost !== Number(formData.cost) && (
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, cost: suggestedCost })}
                            className="font-semibold underline"
                            style={{ color: 'var(--color-primary)' }}
                          >
                            Usar
                          </button>
                        )}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="productstab-orden" className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      Orden
                    </label>
                    <input
                      id="productstab-orden"
                      type="number"
                      value={formData.displayOrder ?? 0}
                      onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value, 10) || 0 })}
                      className="mt-1 w-full rounded-lg border px-4 py-2"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
                      placeholder="0"
                      min="0"
                      step="1"
                    />
                  </div>
                </div>

                {isBeverageCategory(formData.categoryId) && (
                  <div>
                    <label htmlFor="productstab-precio-jumbo" className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      Precio Jumbo
                    </label>
                    <input
                      id="productstab-precio-jumbo"
                      type="number"
                      value={formData.jumboPrice ?? ''}
                      onChange={(event) => setFormData({
                        ...formData,
                        jumboPrice: event.target.value === '' ? null : parseFloat(event.target.value),
                      })}
                      className="mt-1 w-full rounded-lg border px-4 py-2"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
                      placeholder="Sin tamaño Jumbo"
                      min="0"
                      step="0.01"
                    />
                  </div>
                )}

                <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>Receta</h3>
                {detailReady ? (
                  <ProductRecipeSection
                    recipe={recipeDraft}
                    onChange={setRecipeDraft}
                    tracksInventory={tracksInventory}
                    onTracksInventoryChange={setTracksInventory}
                    jumboAvailable={jumboAvailable}
                    price={Number(formData.price) || 0}
                    jumboPrice={formData.jumboPrice ?? null}
                    readOnly={!canManageRecipes}
                    soldBothWays={formData.temperature === 'BOTH'}
                  />
                ) : (
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Cargando receta…</p>
                )}

                {/* Advanced: only needed for grouped products (families) and add-ons. Opens by itself
                    when the product already uses any of them, so no value is ever hidden. */}
                <div className="rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                  <button
                    type="button"
                    aria-expanded={isSaleOptionsOpen}
                    onClick={() => setShowSaleOptions((open) => !open)}
                    disabled={hasSaleOptions}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold disabled:cursor-default"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    <span>
                      Opciones de venta
                      <span className="ml-2 font-normal" style={{ color: 'var(--color-text-secondary)' }}>familia, variantes y extras</span>
                    </span>
                    {!hasSaleOptions && <span style={{ color: 'var(--color-primary)' }}>{isSaleOptionsOpen ? 'Ocultar' : 'Mostrar'}</span>}
                  </button>
                  {isSaleOptionsOpen && (
                    <div className="space-y-4 border-t p-4" style={{ borderColor: 'var(--color-border)' }}>
                    <fieldset className="space-y-2 rounded-lg border p-4" style={{ borderColor: 'var(--color-border)' }}>
                      <legend className="px-1 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        Agrupación en el POS
                      </legend>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                          Familia
                          <select
                            value={familyId}
                            onChange={(event) => setFamilyId(event.target.value)}
                            className="mt-1 w-full rounded-lg border px-3 py-2"
                            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
                          >
                            <option value="">Sin familia (se muestra solo)</option>
                            {families.filter((family) => family.isActive || family.id === familyId).map((family) => (
                              <option key={family.id} value={family.id}>{family.name}</option>
                            ))}
                          </select>
                        </label>
                        <label className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                          Variante
                          <input
                            type="text"
                            value={variantLabel}
                            onChange={(event) => setVariantLabel(event.target.value)}
                            disabled={!familyId}
                            placeholder="Ej: Vainilla"
                            className="mt-1 w-full rounded-lg border px-3 py-2 disabled:opacity-50"
                            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
                          />
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newFamilyName}
                          onChange={(event) => setNewFamilyName(event.target.value)}
                          placeholder="Nueva familia (ej. Frappé)"
                          className="flex-1 rounded-lg border px-3 py-1.5 text-sm"
                          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
                          aria-label="Nombre de la nueva familia"
                        />
                        <button
                          type="button"
                          onClick={handleCreateFamily}
                          disabled={isCreatingFamily || newFamilyName.trim().length < 2}
                          className="rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                        >
                          Crear familia
                        </button>
                      </div>
                      {familyId && (
                        <div className="space-y-2">
                          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            Opciones (sólo si la familia se elige por varias características, p. ej. Salsa y Proteína):
                          </p>
                          {options.map((option, index) => (
                            <div key={index} className="flex gap-2">
                              <input
                                type="text"
                                value={option.name}
                                onChange={(event) => setOptions(options.map((o, i) => (i === index ? { ...o, name: event.target.value } : o)))}
                                placeholder="Característica (Salsa)"
                                className="flex-1 rounded-lg border px-3 py-1.5 text-sm"
                                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
                                aria-label="Nombre de la opción"
                              />
                              <input
                                type="text"
                                value={option.value}
                                onChange={(event) => setOptions(options.map((o, i) => (i === index ? { ...o, value: event.target.value } : o)))}
                                placeholder="Valor (Roja)"
                                className="flex-1 rounded-lg border px-3 py-1.5 text-sm"
                                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
                                aria-label="Valor de la opción"
                              />
                              <button
                                type="button"
                                onClick={() => setOptions(options.filter((_, i) => i !== index))}
                                className="px-2 text-sm font-semibold"
                                style={{ color: 'var(--color-danger)' }}
                                aria-label="Quitar opción"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          {options.length < 5 && (
                            <button
                              type="button"
                              onClick={() => setOptions([...options, { name: '', value: '' }])}
                              className="text-sm font-semibold underline"
                              style={{ color: 'var(--color-primary)' }}
                            >
                              + Agregar opción
                            </button>
                          )}
                        </div>
                      )}
                    </fieldset>
                    {allExtras.length > 0 && (
                      <fieldset>
                        <legend className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                          Extras que se ofrecen en el POS
                        </legend>
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {allExtras.map((extra) => (
                            <label
                              key={extra.id}
                              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                              style={{ borderColor: 'var(--color-border)', color: extra.isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedExtraIds.includes(extra.id)}
                                onChange={() => toggleExtra(extra.id)}
                              />
                              <span className="flex-1">{extra.name}{extra.isActive ? '' : ' (inactivo)'}</span>
                              <span style={{ color: 'var(--color-text-secondary)' }}>{formatCurrency(Number(extra.price))}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    )}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSave}
                    disabled={isSaving || !detailReady}
                    className="flex-1 rounded-lg px-4 py-2 font-semibold text-[var(--color-button-text)] transition disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    {isSaving ? (editingProduct ? 'Actualizando...' : 'Creando...') : (editingProduct ? 'Actualizar' : 'Crear')}
                  </button>
                  <button
                    onClick={() => {
                      if (isSaving) return
                      setIsCreateModalOpen(false)
                      setEditingProduct(null)
                      resetImageState()
                    }}
                    disabled={isSaving}
                    className="flex-1 rounded-lg border px-4 py-2 font-semibold transition"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="Eliminar Producto"
        message="¿Estás seguro de que deseas eliminar este producto? Si tiene historial de ventas, no podrá eliminarse. En ese caso, considera desactivarlo en su lugar."
        confirmText="Eliminar"
        cancelText="Cancelar"
        isDangerous
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        onCancel={() => {
          setDeleteConfirmOpen(false)
          setProductToDelete(null)
        }}
      />

      <ConfirmDialog
        isOpen={productToDeactivate !== null}
        title="Desactivar producto"
        message={`"${productToDeactivate?.name ?? ''}" dejará de mostrarse en el menú de venta. Podrás activarlo de nuevo cuando quieras.`}
        confirmText="Desactivar"
        isDangerous
        isLoading={togglingProductId !== null}
        onConfirm={() => {
          if (!productToDeactivate) return
          setActive({ id: productToDeactivate.id, isActive: false }, { onSettled: () => setProductToDeactivate(null) })
        }}
        onCancel={() => setProductToDeactivate(null)}
      />

      {/* Image removal confirmation */}
      <ConfirmDialog
        isOpen={removeImageConfirmOpen}
        title="Quitar imagen"
        message="El producto mostrará la imagen por defecto en el catálogo y en el menú de ventas. El archivo se elimina si ningún otro producto lo usa."
        confirmText="Quitar"
        cancelText="Cancelar"
        isDangerous
        isLoading={productImage.isRemoving}
        onConfirm={handleRemoveImage}
        onCancel={() => setRemoveImageConfirmOpen(false)}
      />

      {/* Category Manager Modal */}
      <CategoryManagerModal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} />
    </div>
  )
}
