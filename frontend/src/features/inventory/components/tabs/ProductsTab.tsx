import { useState } from 'react'
import { useProducts, useCategories, useProductDetail, useProductImage } from '../../../products/hooks/useProducts'
import { useImageDraft } from '../../../products/hooks/useImageDraft'
import { ProductImageField } from '../../../products/components/ProductImageField'
import { ProductImage } from '../../../../shared/components/ProductImage'
import { useExtras, useSetProductExtras } from '../../../extras/hooks/useExtras'
import { authStore } from '../../../auth/store/auth.store'
import { hasPermission } from '../../../auth/utils/permissions'
import { Card } from '../../../../shared/components/Card'
import { ConfirmDialog } from '../../../../shared/components/ConfirmDialog'
import { Modal } from '../../../../shared/components/Modal'
import { formatCurrency } from '../../../../shared/utils/formatCurrency'
import { getErrorMessage } from '../../../../shared/utils/errors'
import { CategoryManagerModal } from '../CategoryManagerModal'
import { sileo } from 'sileo'
import type { CreateProductInput, UpdateProductInput } from '../../../products/types/product.types'
import type { Product } from '../../../products/types/product.types'
import { formatDrinkTemperature, getDrinkTemperature } from '../../../../shared/utils/productTemperature'
import type { ProductTemperature } from '../../../../shared/utils/productTemperature'

export function ProductsTab() {
  const currentUser = authStore.getState().user
  const {
    products,
    loading,
    error,
    page,
    setPage,
    totalPages,
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
    isLoadingActive,
  } = useProducts()
  const { categories } = useCategories()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  // R-04: recipe-based cost hint, only when editing an existing product.
  const { data: editingDetail } = useProductDetail(editingProduct?.id)
  const suggestedCost =
    editingDetail?.suggestedCost !== null && editingDetail?.suggestedCost !== undefined
      ? Number(editingDetail.suggestedCost)
      : null
  // Extras offered with the product in the POS (saved with their own endpoint after the product).
  const { data: allExtras = [] } = useExtras(isCreateModalOpen)
  const setProductExtras = useSetProductExtras()
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([])
  const [extrasLoadedFor, setExtrasLoadedFor] = useState<string | null>(null)
  if (editingDetail && editingDetail.id === editingProduct?.id && extrasLoadedFor !== editingDetail.id) {
    setExtrasLoadedFor(editingDetail.id)
    setSelectedExtraIds((editingDetail.extras ?? []).map(({ extraId }) => extraId))
  }
  const savedExtraIds = (editingDetail?.extras ?? []).map(({ extraId }) => extraId)
  const extrasChanged =
    selectedExtraIds.length !== savedExtraIds.length || selectedExtraIds.some((id) => !savedExtraIds.includes(id))
  const toggleExtra = (extraId: string) =>
    setSelectedExtraIds((current) => (current.includes(extraId) ? current.filter((id) => id !== extraId) : [...current, extraId]))
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<string | null>(null)

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

  // Fill (or clear) the form whenever the product being edited changes — adjusted during
  // render instead of in an effect, as recommended by React.
  const [formProduct, setFormProduct] = useState<Product | null>(null)
  if (editingProduct !== formProduct) {
    setFormProduct(editingProduct)
    // Another product (or a new one): its extras are loaded from its detail, not carried over.
    setSelectedExtraIds([])
    setExtrasLoadedFor(null)
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

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.sku?.trim() || formData.price < 0 || formData.cost < 0) {
      sileo.error({ title: 'Error', description: 'Por favor completa los campos requeridos' })
      return
    }

    if (isBeverageCategory(formData.categoryId) && !formData.temperature) {
      sileo.error({ title: 'Error', description: 'Selecciona si la bebida es caliente o fría.' })
      return
    }

    try {
      if (editingProduct) {
        await updateAsync({
          input: {
            id: editingProduct.id,
            ...formData,
          } as UpdateProductInput,
        })
        if (extrasChanged) {
          await setProductExtras.mutateAsync({ productId: editingProduct.id, extraIds: selectedExtraIds })
        }
        sileo.success({ title: 'Éxito', description: 'Producto actualizado correctamente' })
        // A photo picked but not confirmed yet is uploaded with the save instead of being lost.
        if (imageDraft.draft) await uploadPendingImage(editingProduct.id, imageDraft.draft.file)
      } else {
        const created = await createAsync({ input: formData })
        if (selectedExtraIds.length > 0 && created?.id) {
          await setProductExtras.mutateAsync({ productId: created.id, extraIds: selectedExtraIds })
        }
        sileo.success({ title: 'Éxito', description: 'Producto creado correctamente' })
        // New products need their id before the photo can be uploaded.
        if (imageDraft.draft && created?.id) await uploadPendingImage(created.id, imageDraft.draft.file)
      }
      setSelectedExtraIds([])
      setExtrasLoadedFor(null)

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

  const handleToggleActive = (productId: string, currentStatus: boolean) => {
    setActive({ id: productId, isActive: !currentStatus })
  }

  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return 'Sin categoría'
    return categories.find((c) => c.id === categoryId)?.name || 'Desconocida'
  }

  const isBeverageCategory = (categoryId?: string) =>
    getCategoryName(categoryId).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() === 'bebidas'

  const isLatteProduct = (name: string, categoryId?: string) => {
    const normalizedName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
    return isBeverageCategory(categoryId) && normalizedName.startsWith('latte ') && normalizedName !== 'latte jumbo'
  }

  const getProductTemperature = (product: Product): ProductTemperature | null =>
    product.temperature ?? getDrinkTemperature(product.name, getCategoryName(product.categoryId))

  if (error) {
    return (
      <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--color-danger)', color: 'white' }}>
        Error al cargar productos: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Administra los productos que se venden en el menú
          </p>
        </div>
        <div className="flex gap-2">
          {canCreate && (
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="rounded-lg px-4 py-2 font-semibold transition"
              style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              ⚙️ Gestionar Categorías
            </button>
          )}
          {canCreate && (
            <button
              onClick={() => {
                resetImageState()
                setEditingProduct(null)
                setIsCreateModalOpen(true)
              }}
              className="rounded-lg px-4 py-2 font-semibold text-white transition"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              + Nuevo Producto
            </button>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
            Buscar
          </label>
          <input
            type="text"
            placeholder="Nombre o SKU..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full rounded-lg border px-4 py-2 text-sm"
            style={{ borderColor: 'var(--color-border)' }}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
            Categoría
          </label>
          <select
            value={categoryFilter || ''}
            onChange={(e) => {
              setCategoryFilter(e.target.value || undefined)
              setPage(1)
            }}
            className="w-full rounded-lg border px-4 py-2 text-sm"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <option value="">Todas</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
            Estado
          </label>
          <select
            value={
              statusFilter === undefined ? '' : statusFilter === true ? 'active' : 'inactive'
            }
            onChange={(e) => {
              if (e.target.value === '') setStatusFilter(undefined)
              else if (e.target.value === 'active') setStatusFilter(true)
              else setStatusFilter(false)
              setPage(1)
            }}
            className="w-full rounded-lg border px-4 py-2 text-sm"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <option value="">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
            Limpiar
          </label>
          <button
            onClick={() => {
              setSearch('')
              setCategoryFilter(undefined)
              setStatusFilter(undefined)
              setPage(1)
            }}
            className="w-full rounded-lg border px-4 py-2 text-sm font-medium transition"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            Restablecer
          </button>
        </div>
      </div>

      {/* Products Table */}
      <Card>
        {loading ? (
          <div className="p-6 text-center" style={{ color: 'var(--color-text-secondary)' }}>
            Cargando productos...
          </div>
        ) : products.length === 0 ? (
          <div className="p-6 text-center" style={{ color: 'var(--color-text-secondary)' }}>
            No hay productos registrados
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th className="px-6 py-3 text-left font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Categoría
                  </th>
                  <th className="px-6 py-3 text-left font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Temperatura
                  </th>
                  <th className="px-6 py-3 text-right font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Precio
                  </th>
                  <th className="px-6 py-3 text-right font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Costo
                  </th>
                  <th className="px-6 py-3 text-center font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Estado
                  </th>
                  <th className="px-6 py-3 text-center font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="px-6 py-4" style={{ color: 'var(--color-text-primary)' }}>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                          <ProductImage src={product.imageUrl} alt="" />
                        </div>
                        <span>{product.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4" style={{ color: 'var(--color-text-secondary)' }}>
                      {product.sku}
                    </td>
                    <td className="px-6 py-4" style={{ color: 'var(--color-text-secondary)' }}>
                      {getCategoryName(product.categoryId)}
                    </td>
                    <td className="px-6 py-4" style={{ color: 'var(--color-text-secondary)' }}>
                      {isBeverageCategory(product.categoryId)
                        ? getProductTemperature(product) ? formatDrinkTemperature(getProductTemperature(product)!) : 'Sin definir'
                        : '—'}
                    </td>
                    <td className="px-6 py-4 text-right" style={{ color: 'var(--color-text-primary)' }}>
                      {formatCurrency(product.price)}
                    </td>
                    <td className="px-6 py-4 text-right" style={{ color: 'var(--color-text-secondary)' }}>
                      {formatCurrency(product.cost)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleToggleActive(product.id, product.isActive)}
                        disabled={isLoadingActive}
                        className="inline-block rounded px-2 py-1 text-xs font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          backgroundColor: product.isActive ? 'var(--color-success)' : 'var(--color-warning)',
                        }}
                      >
                        {isLoadingActive ? 'Cambiando...' : (product.isActive ? 'Activo' : 'Inactivo')}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {canUpdate && (
                          <button
                            onClick={() => {
                              resetImageState()
                              setEditingProduct(product)
                              setIsCreateModalOpen(true)
                            }}
                            className="rounded px-2 py-1 text-xs font-semibold transition"
                            style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                          >
                            Editar
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteClick(product.id)}
                            disabled={isDeleting}
                            className="rounded px-2 py-1 text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ backgroundColor: 'var(--color-danger)', color: 'white' }}
                          >
                            {isDeleting ? 'Eliminando...' : 'Eliminar'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination Footer */}
      {!loading && products.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <span style={{ color: 'var(--color-text-secondary)' }} className="text-sm">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              Siguiente
            </button>
          </div>
        </div>
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
      >
            <div className="space-y-4 p-6">
              <h2 id="product-modal-title" className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {editingProduct ? 'Editar Producto' : 'Crear Nuevo Producto'}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 w-full rounded-lg border px-4 py-2"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
                    placeholder="Nombre del producto"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    SKU *
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="mt-1 w-full rounded-lg border px-4 py-2"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
                    placeholder="SKU único"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Descripción
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-1 w-full rounded-lg border px-4 py-2"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
                    placeholder="Descripción del producto"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Categoría
                  </label>
                  <select
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

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      Precio *
                    </label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                      className="mt-1 w-full rounded-lg border px-4 py-2"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      Costo *
                    </label>
                    <input
                      type="number"
                      value={formData.cost}
                      onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) })}
                      className="mt-1 w-full rounded-lg border px-4 py-2"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                    {suggestedCost !== null && (
                      <p className="mt-1 flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
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
                    <label className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      Orden
                    </label>
                    <input
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

                {isLatteProduct(formData.name, formData.categoryId) && (
                  <div>
                    <label className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      Precio Jumbo
                    </label>
                    <input
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

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 rounded-lg px-4 py-2 font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Category Manager Modal */}
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

      <CategoryManagerModal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} />
    </div>
  )
}
