import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCategories } from '../../products/hooks/useProducts'
import { authStore } from '../../auth/store/auth.store'
import { hasPermission } from '../../auth/utils/permissions'
import { Card } from '../../../shared/components/Card'
import { sileo } from 'sileo'
import type { Category } from '../../products/types/product.types'

interface CategoryManagerModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CategoryManagerModal({ isOpen, onClose }: CategoryManagerModalProps) {
  const currentUser = authStore.getState().user
  const { categories, create, update, setActive } = useCategories()

  const [formData, setFormData] = useState<Partial<Category> & { id?: string }>({
    name: '',
    description: '',
    displayOrder: 0,
  })
  const [editingId, setEditingId] = useState<string | null>(null)

  const canCreate = hasPermission(currentUser, 'categories.create')
  const canUpdate = hasPermission(currentUser, 'categories.update')

  const handleSave = () => {
    if (!formData.name?.trim()) {
      sileo.error({ title: 'Error', description: 'El nombre es requerido' })
      return
    }

    if (editingId) {
      update({
        id: editingId,
        input: {
          name: formData.name,
          description: formData.description,
          displayOrder: formData.displayOrder,
        },
      })
      sileo.success({ title: 'Éxito', description: 'Categoría actualizada correctamente' })
    } else {
      create({
        name: formData.name,
        description: formData.description,
        displayOrder: formData.displayOrder,
      })
      sileo.success({ title: 'Éxito', description: 'Categoría creada correctamente' })
    }

    setFormData({ name: '', description: '', displayOrder: 0 })
    setEditingId(null)
  }

  const handleEdit = (category: Category) => {
    setEditingId(category.id)
    setFormData({
      name: category.name,
      description: category.description,
      displayOrder: category.displayOrder,
    })
  }

  const handleToggleActive = (categoryId: string, currentStatus: boolean) => {
    setActive({ id: categoryId, isActive: !currentStatus })
  }

  const handleCancel = () => {
    setFormData({ name: '', description: '', displayOrder: 0 })
    setEditingId(null)
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg p-6"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Gestionar Categorías
            </h2>
            <button
              onClick={onClose}
              className="text-2xl font-semibold"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              ✕
            </button>
          </div>

          {/* Add/Edit Form */}
          {canCreate && (
            <Card className="mb-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {editingId ? 'Editar Categoría' : 'Nueva Categoría'}
                </h3>

                <div>
                  <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border px-4 py-2 text-sm"
                    style={{ borderColor: 'var(--color-border)' }}
                    placeholder="Nombre de la categoría"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                    Descripción
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full rounded-lg border px-4 py-2 text-sm"
                    style={{ borderColor: 'var(--color-border)' }}
                    placeholder="Descripción"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                    Orden
                  </label>
                  <input
                    type="number"
                    value={formData.displayOrder ?? 0}
                    onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value, 10) || 0 })}
                    className="w-full rounded-lg border px-4 py-2 text-sm"
                    style={{ borderColor: 'var(--color-border)' }}
                    min="0"
                    step="1"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSave}
                    className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white transition"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    {editingId ? 'Actualizar' : 'Crear'}
                  </button>
                  {editingId && (
                    <button
                      onClick={handleCancel}
                      className="flex-1 rounded-lg border px-4 py-2 text-sm font-semibold transition"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Categories List */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Categorías ({categories.length})
            </h3>
            {categories.length === 0 ? (
              <p style={{ color: 'var(--color-text-secondary)' }} className="text-sm">
                No hay categorías
              </p>
            ) : (
              <div className="space-y-2">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>
                        {category.name}
                      </p>
                      {category.description && (
                        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                          {category.description}
                        </p>
                      )}
                      <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        Orden: {category.displayOrder}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleActive(category.id, category.isActive)}
                        className="rounded px-2 py-1 text-xs font-semibold text-white transition"
                        style={{
                          backgroundColor: category.isActive ? 'var(--color-success)' : 'var(--color-warning)',
                        }}
                      >
                        {category.isActive ? 'Activo' : 'Inactivo'}
                      </button>
                      {canUpdate && (
                        <button
                          onClick={() => handleEdit(category)}
                          className="rounded px-2 py-1 text-xs font-semibold text-white transition"
                          style={{ backgroundColor: 'var(--color-primary)' }}
                        >
                          Editar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
