import { useState, useEffect, useRef } from 'react'
import type { Product, CreateProductInput, Category } from '../types/product.types'

interface ProductFormModalProps {
  product?: Product
  categories: Category[]
  onSubmit: (data: CreateProductInput) => void
  onCancel: () => void
  isLoading?: boolean
}

export function ProductFormModal({
  product,
  categories,
  onSubmit,
  onCancel,
  isLoading = false,
}: ProductFormModalProps) {
  const formRef = useRef<HTMLDivElement>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState<CreateProductInput>({
    name: product?.name || '',
    sku: product?.sku || '',
    description: product?.description || '',
    price: product?.price || 0,
    cost: product?.cost || 0,
    categoryId: product?.categoryId || '',
    displayOrder: product?.displayOrder || 0,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    firstInputRef.current?.focus()

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) newErrors.name = 'Ingresa el nombre del producto'
    if (!formData.sku.trim()) newErrors.sku = 'Ingresa un SKU único para el producto'
    if (formData.price < 0) newErrors.price = 'El precio debe ser mayor a 0'
    if (formData.cost < 0) newErrors.cost = 'El costo debe ser mayor a 0'
    if (formData.price < formData.cost) newErrors.price = 'El precio debe ser mayor que el costo'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      onSubmit(formData)
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 z-50"
      onClick={onCancel}
      role="presentation"
    >
      <div
        ref={formRef}
        className="rounded-xl shadow-xl p-6 w-full max-w-md"
        style={{ backgroundColor: 'var(--color-surface)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <h2 id="modal-title" className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          {product ? 'Editar Producto' : 'Crear Producto'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre */}
          <div>
            <label htmlFor="product-name" className="block text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
              Nombre <span style={{ color: 'var(--color-danger)' }} title="Campo requerido">*</span>
            </label>
            <input
              id="product-name"
              ref={firstInputRef}
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              aria-label="Nombre del producto"
              aria-required="true"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'name-error' : undefined}
              className="w-full px-3 py-2 border rounded-lg"
              style={{
                borderColor: errors.name ? 'var(--color-danger)' : 'var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
              }}
            />
            {errors.name && <p id="name-error" className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.name}</p>}
          </div>

          {/* SKU */}
          <div>
            <label htmlFor="product-sku" className="block text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
              SKU <span style={{ color: 'var(--color-danger)' }} title="Campo requerido">*</span>
            </label>
            <input
              id="product-sku"
              type="text"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              aria-label="SKU del producto"
              aria-required="true"
              aria-invalid={!!errors.sku}
              aria-describedby={errors.sku ? 'sku-error' : undefined}
              className="w-full px-3 py-2 border rounded-lg"
              style={{
                borderColor: errors.sku ? 'var(--color-danger)' : 'var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
              }}
            />
            {errors.sku && <p id="sku-error" className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.sku}</p>}
          </div>

          {/* Descripción */}
          <div>
            <label htmlFor="product-description" className="block text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
              Descripción
            </label>
            <textarea
              id="product-description"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              aria-label="Descripción del producto"
              className="w-full px-3 py-2 border rounded-lg"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
              }}
              rows={2}
            />
          </div>

          {/* Categoría */}
          <div>
            <label htmlFor="product-category" className="block text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
              Categoría
            </label>
            <select
              id="product-category"
              value={formData.categoryId || ''}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value || undefined })}
              aria-label="Categoría del producto"
              className="w-full px-3 py-2 border rounded-lg"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
              }}
            >
              <option value="">Sin categoría</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Precio */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="product-price" className="block text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                Precio <span style={{ color: 'var(--color-danger)' }} title="Campo requerido">*</span>
              </label>
              <input
                id="product-price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                aria-label="Precio de venta del producto"
                aria-required="true"
                aria-invalid={!!errors.price}
                aria-describedby={errors.price ? 'price-error' : undefined}
                className="w-full px-3 py-2 border rounded-lg"
                style={{
                  borderColor: errors.price ? 'var(--color-danger)' : 'var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                }}
              />
              {errors.price && <p id="price-error" className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.price}</p>}
            </div>
            <div>
              <label htmlFor="product-cost" className="block text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                Costo <span style={{ color: 'var(--color-danger)' }} title="Campo requerido">*</span>
              </label>
              <input
                id="product-cost"
                type="number"
                step="0.01"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                aria-label="Costo del producto"
                aria-required="true"
                aria-invalid={!!errors.cost}
                aria-describedby={errors.cost ? 'cost-error' : undefined}
                className="w-full px-3 py-2 border rounded-lg"
                style={{
                  borderColor: errors.cost ? 'var(--color-danger)' : 'var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                }}
              />
              {errors.cost && <p id="cost-error" className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.cost}</p>}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border rounded-lg text-sm font-semibold transition"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
            >
              {isLoading ? 'Guardando...' : product ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
