import { useState, useEffect } from 'react'
import { authStore } from '../../auth/store/auth.store'
import type { AuthUser } from '../../auth/types/auth.types'
import { hasPermission } from '../../auth/utils/permissions'
import { useProducts, useCategories } from '../hooks/useProducts'
import type { Product, CreateProductInput } from '../types/product.types'
import { ProductsTable } from '../components/ProductsTable'
import { ProductFormModal } from '../components/ProductFormModal'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'

export function ProductsCatalogPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(authStore.getState().user)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | undefined>()
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; product: Product | null }>({
    isOpen: false,
    product: null,
  })

  const { products, loading, create, update, delete: deleteProduct, setActive } = useProducts()
  const { categories } = useCategories()

  useEffect(() => {
    const handleAuthChange = () => {
      setCurrentUser(authStore.getState().user)
    }
    window.addEventListener('auth:changed', handleAuthChange)
    return () => window.removeEventListener('auth:changed', handleAuthChange)
  }, [])

  const canCreate = hasPermission(currentUser, 'products.create')
  const canEdit = hasPermission(currentUser, 'products.update')
  const canDelete = hasPermission(currentUser, 'products.delete')

  const handleOpenForm = (product?: Product) => {
    setEditingProduct(product)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setEditingProduct(undefined)
    setIsFormOpen(false)
  }

  const handleSubmit = (data: CreateProductInput) => {
    if (editingProduct) {
      update({ ...data, id: editingProduct.id })
    } else {
      create(data)
    }
    handleCloseForm()
  }

  const handleDelete = (product: Product) => {
    setDeleteConfirm({ isOpen: true, product })
  }

  const handleConfirmDelete = () => {
    if (deleteConfirm.product) {
      deleteProduct(deleteConfirm.product.id)
      setDeleteConfirm({ isOpen: false, product: null })
    }
  }

  const handleCancelDelete = () => {
    setDeleteConfirm({ isOpen: false, product: null })
  }

  if (!canCreate && !canEdit && !canDelete) {
    return (
      <div className="p-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>
        <p>No tienes permisos para gestionar productos</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Catálogo de Productos
        </h1>
        {canCreate && (
          <button
            onClick={() => handleOpenForm()}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
            style={{ backgroundColor: 'var(--color-success)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-success-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-success)'}
          >
            + Crear Producto
          </button>
        )}
      </div>

      <ProductsTable
        products={products}
        loading={loading}
        onEdit={(product) => canEdit && handleOpenForm(product)}
        onDelete={handleDelete}
        onToggleActive={(product) => setActive({ id: product.id, isActive: !product.isActive })}
        currentUser={currentUser}
      />

      {isFormOpen && (
        <ProductFormModal
          product={editingProduct}
          categories={categories}
          onSubmit={handleSubmit}
          onCancel={handleCloseForm}
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Eliminar Producto"
        message={`¿Estás seguro de que deseas eliminar "${deleteConfirm.product?.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        isDangerous={true}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  )
}
