import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useProducts, useCategories, useProductDetail } from '../../../products/hooks/useProducts'
import { authStore } from '../../../auth/store/auth.store'
import { hasPermission } from '../../../auth/utils/permissions'
import { Card } from '../../../../shared/components/Card'
import { ConfirmDialog } from '../../../../shared/components/ConfirmDialog'
import { formatCurrency } from '../../../../shared/utils/formatCurrency'
import { CategoryManagerModal } from '../CategoryManagerModal'
import { sileo } from 'sileo'
import type { CreateProductInput, UpdateProductInput } from '../../../products/types/product.types'

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
    create,
    update,
    delete: deleteProduct,
    setActive,
    isCreating,
    isUpdating,
    isDeleting,
    isLoadingActive,
  } = useProducts()
  const { categories } = useCategories()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any>(null)
  // R-04: recipe-based cost hint, only when editing an existing product.
  const { data: editingDetail } = useProductDetail(editingProduct?.id)
  const suggestedCost =
    editingDetail?.suggestedCost !== null && editingDetail?.suggestedCost !== undefined
      ? Number(editingDetail.suggestedCost)
      : null
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<string | null>(null)

  const [formData, setFormData] = useState<CreateProductInput>({
    name: '',
    description: '',
    sku: '',
    price: 0,
    cost: 0,
    categoryId: '',
    displayOrder: 0,
  })
  const [imageFile, setImageFile] = useState<File | null>(null)

  useEffect(() => {
    if (editingProduct) {
      setFormData({
        name: editingProduct.name,
        description: editingProduct.description || '',
        sku: editingProduct.sku,
        price: editingProduct.price,
        cost: editingProduct.cost,
        categoryId: editingProduct.categoryId || '',
        displayOrder: editingProduct.displayOrder,
      })
    } else {
      setFormData({
        name: '',
        description: '',
        sku: '',
        price: 0,
        cost: 0,
        categoryId: '',
        displayOrder: 0,
      })
    }
  }, [editingProduct])

  const canCreate = hasPermission(currentUser, 'products.create')
  const canUpdate = hasPermission(currentUser, 'products.update')
  const canDelete = hasPermission(currentUser, 'products.delete')

  const handleSave = () => {
    if (!formData.name.trim() || !formData.sku?.trim() || formData.price < 0 || formData.cost < 0) {
      sileo.error({ title: 'Error', description: 'Por favor completa los campos requeridos' })
      return
    }

    if (editingProduct) {
      update({
        input: {
          id: editingProduct.id,
          ...formData,
        } as UpdateProductInput,
        imageFile: imageFile || undefined,
      })
      sileo.success({ title: 'Éxito', description: 'Producto actualizado correctamente' })
    } else {
      create({ input: formData, imageFile: imageFile || undefined })
      sileo.success({ title: 'Éxito', description: 'Producto creado correctamente' })
    }

    setIsCreateModalOpen(false)
    setEditingProduct(null)
    setImageFile(null)
  }

  const handleDeleteClick = (productId: string) => {
    setProductToDelete(productId)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = () => {
    if (productToDelete) {
      deleteProduct(productToDelete)
      sileo.success({ title: 'Éxito', description: 'Producto eliminado correctamente' })
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
                      {product.name}
                    </td>
                    <td className="px-6 py-4" style={{ color: 'var(--color-text-secondary)' }}>
                      {product.sku}
                    </td>
                    <td className="px-6 py-4" style={{ color: 'var(--color-text-secondary)' }}>
                      {getCategoryName(product.categoryId)}
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
      <AnimatePresence mode="wait">
        {isCreateModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setIsCreateModalOpen(false)
              setEditingProduct(null)
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="product-modal-title"
              className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-lg p-6"
              style={{ backgroundColor: 'var(--color-surface)' }}
            >
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
                    style={{ borderColor: 'var(--color-border)' }}
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
                    style={{ borderColor: 'var(--color-border)' }}
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
                    style={{ borderColor: 'var(--color-border)' }}
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
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value || undefined })}
                    className="mt-1 w-full rounded-lg border px-4 py-2"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <option value="">Sin categoría</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Imagen
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    className="mt-1 w-full rounded-lg border px-4 py-2"
                    style={{ borderColor: 'var(--color-border)' }}
                  />
                  {imageFile && (
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                      📁 {imageFile.name}
                    </p>
                  )}
                </div>

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
                      style={{ borderColor: 'var(--color-border)' }}
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
                      style={{ borderColor: 'var(--color-border)' }}
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
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="0"
                      min="0"
                      step="1"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSave}
                    disabled={isCreating || isUpdating}
                    className="flex-1 rounded-lg px-4 py-2 font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    {isCreating || isUpdating ? (editingProduct ? 'Actualizando...' : 'Creando...') : (editingProduct ? 'Actualizar' : 'Crear')}
                  </button>
                  <button
                    onClick={() => {
                      setIsCreateModalOpen(false)
                      setEditingProduct(null)
                    }}
                    className="flex-1 rounded-lg border px-4 py-2 font-semibold transition"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="Eliminar Producto"
        message="¿Estás seguro de que deseas eliminar este producto? Si tiene historial de ventas, no podrá eliminarse. En ese caso, considera desactivarlo en su lugar."
        confirmText="Eliminar"
        cancelText="Cancelar"
        isDangerous
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteConfirmOpen(false)
          setProductToDelete(null)
        }}
      />

      {/* Category Manager Modal */}
      <CategoryManagerModal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} />
    </div>
  )
}
