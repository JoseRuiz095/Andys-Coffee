import { useState } from 'react'
import { Modal } from '../../../shared/components/Modal'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { useCategories } from '../../products/hooks/useProducts'
import { authStore } from '../../auth/store/auth.store'
import { hasPermission } from '../../auth/utils/permissions'
import { Card } from '../../../shared/components/Card'
import { getErrorMessage } from '../../../shared/utils/errors'
import { sileo } from 'sileo'
import type { Category } from '../../products/types/product.types'

interface CategoryManagerModalProps {
  isOpen: boolean
  onClose: () => void
}

const EMPTY_FORM = { name: '', description: '', displayOrder: 0 }

const inputStyle = {
  borderColor: 'var(--color-border)',
  backgroundColor: 'var(--color-input-bg)',
  color: 'var(--color-input-text)',
}

export function CategoryManagerModal({ isOpen, onClose }: CategoryManagerModalProps) {
  const currentUser = authStore.getState().user
  const { categories, create, update, setActive, remove, isCreating, isUpdating, isLoadingActive, isDeleting } =
    useCategories({ includeInactive: true })

  const [formData, setFormData] = useState<Partial<Category> & { id?: string }>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)

  const canCreate = hasPermission(currentUser, 'categories.create')
  const canUpdate = hasPermission(currentUser, 'categories.update')
  const canDelete = hasPermission(currentUser, 'categories.delete')
  const isSaving = isCreating || isUpdating
  const showForm = editingId ? canUpdate : canCreate

  const resetForm = () => {
    setFormData(EMPTY_FORM)
    setEditingId(null)
  }

  const handleSave = () => {
    if (!formData.name?.trim()) {
      sileo.error({ title: 'Error', description: 'El nombre es requerido' })
      return
    }

    const input = {
      name: formData.name.trim(),
      description: formData.description,
      displayOrder: formData.displayOrder ?? 0,
    }

    if (editingId) {
      update(
        { id: editingId, input },
        {
          onSuccess: () => {
            sileo.success({ title: 'Categoría actualizada', description: `"${input.name}" se guardó correctamente.` })
            resetForm()
          },
          onError: (error: unknown) =>
            sileo.error({ title: 'Error', description: getErrorMessage(error, 'No se pudo actualizar la categoría.') }),
        },
      )
    } else {
      create(input, {
        onSuccess: () => {
          sileo.success({ title: 'Categoría creada', description: `"${input.name}" se agregó correctamente.` })
          resetForm()
        },
        onError: (error: unknown) =>
          sileo.error({ title: 'Error', description: getErrorMessage(error, 'No se pudo crear la categoría.') }),
      })
    }
  }

  const handleEdit = (category: Category) => {
    setEditingId(category.id)
    setFormData({
      name: category.name,
      description: category.description,
      displayOrder: category.displayOrder,
    })
  }

  const handleToggleActive = (category: Category) => {
    setActive(
      { id: category.id, isActive: !category.isActive },
      {
        onError: (error: unknown) =>
          sileo.error({ title: 'Error', description: getErrorMessage(error, 'No se pudo cambiar el estado.') }),
      },
    )
  }

  const handleConfirmDelete = () => {
    if (!categoryToDelete) return
    const { id, name } = categoryToDelete
    remove(id, {
      onSuccess: () => {
        sileo.success({ title: 'Categoría eliminada', description: `"${name}" se eliminó correctamente.` })
        setCategoryToDelete(null)
        if (editingId === id) resetForm()
      },
      onError: (error: unknown) =>
        sileo.error({ title: 'No se pudo eliminar', description: getErrorMessage(error, 'No se pudo eliminar la categoría.') }),
    })
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        ariaLabelledBy="category-modal-title"
        maxWidthClassName="max-w-2xl"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 id="category-modal-title" className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Gestionar Categorías
            </h2>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="text-2xl font-semibold"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              ✕
            </button>
          </div>

          {/* Add/Edit Form */}
          {showForm && (
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
                    style={inputStyle}
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
                    style={inputStyle}
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
                    style={inputStyle}
                    min="0"
                    step="1"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-button-text)' }}
                  >
                    {isSaving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
                  </button>
                  {editingId && (
                    <button
                      onClick={resetForm}
                      disabled={isSaving}
                      className="flex-1 rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </Card>
          )}

          {!canCreate && !canUpdate && !canDelete && (
            <p className="mb-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Tu rol no tiene permisos para modificar categorías; solo puedes consultarlas.
            </p>
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
                        onClick={() => handleToggleActive(category)}
                        disabled={!canUpdate || isLoadingActive}
                        className="rounded px-2 py-1 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                        style={{
                          backgroundColor: category.isActive ? 'var(--color-success)' : 'var(--color-warning)',
                        }}
                      >
                        {category.isActive ? 'Activo' : 'Inactivo'}
                      </button>
                      {canUpdate && (
                        <button
                          onClick={() => handleEdit(category)}
                          className="rounded px-2 py-1 text-xs font-semibold transition"
                          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-button-text)' }}
                        >
                          Editar
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setCategoryToDelete(category)}
                          disabled={isDeleting}
                          className="rounded px-2 py-1 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                          style={{ backgroundColor: 'var(--color-danger)' }}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={categoryToDelete !== null}
        title="Eliminar Categoría"
        message={`¿Estás seguro de que deseas eliminar la categoría "${categoryToDelete?.name ?? ''}"? Si tiene productos o combos no podrá eliminarse; en ese caso desactívala.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        isDangerous
        onConfirm={handleConfirmDelete}
        onCancel={() => setCategoryToDelete(null)}
        isLoading={isDeleting}
      />
    </>
  )
}
