import { useState } from 'react'
import { Modal } from '../../../shared/components/Modal'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { useCategories } from '../../products/hooks/useProducts'
import { hasPermission } from '../../auth/utils/permissions'
import { Card } from '../../../shared/components/Card'
import { getErrorMessage } from '../../../shared/utils/errors'
import { sileo } from 'sileo'
import type { Category } from '../../products/types/product.types'
import { useCurrentUser } from '../../auth/hooks/useCurrentUser'
import { ACTION_DANGER_CLASS, ACTION_PRIMARY_CLASS, ACTION_SECONDARY_CLASS } from '../../../shared/constants/actionStyles'

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
  const currentUser = useCurrentUser()
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

  // Deactivating hides the category (and its products) from the POS menu: it is confirmed first.
  const [categoryToDeactivate, setCategoryToDeactivate] = useState<Category | null>(null)

  const changeActive = (category: Category, isActive: boolean) => {
    setActive(
      { id: category.id, isActive },
      {
        onError: (error: unknown) =>
          sileo.error({ title: 'Error', description: getErrorMessage(error, 'No se pudo cambiar el estado.') }),
        onSettled: () => setCategoryToDeactivate(null),
      },
    )
  }

  const handleToggleActive = (category: Category) => {
    if (category.isActive) setCategoryToDeactivate(category)
    else changeActive(category, true)
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
                  <label htmlFor="categorymanagermodal-nombre" className="block text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                    Nombre *
                  </label>
                  <input
                    id="categorymanagermodal-nombre"
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border px-4 py-2 text-sm"
                    style={inputStyle}
                    placeholder="Nombre de la categoría"
                  />
                </div>

                <div>
                  <label htmlFor="categorymanagermodal-descripcion" className="block text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                    Descripción
                  </label>
                  <textarea
                    id="categorymanagermodal-descripcion"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full rounded-lg border px-4 py-2 text-sm"
                    style={inputStyle}
                    placeholder="Descripción"
                    rows={2}
                  />
                </div>

                <div>
                  <label htmlFor="categorymanagermodal-orden" className="block text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                    Orden
                  </label>
                  <input
                    id="categorymanagermodal-orden"
                    type="number"
                    value={formData.displayOrder ?? 0}
                    onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value, 10) || 0 })}
                    className="w-full rounded-lg border px-4 py-2 text-sm"
                    style={inputStyle}
                    min="0"
                    step="1"
                  />
                </div>

                <div className="flex gap-2 pt-2 text-sm">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`${ACTION_PRIMARY_CLASS} flex-1`}
                  >
                    {isSaving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
                  </button>
                  {editingId && (
                    <button
                      onClick={resetForm}
                      disabled={isSaving}
                      className={`${ACTION_SECONDARY_CLASS} flex-1`}
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
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {category.name}
                      </p>
                      <p className="text-[0.8125rem]" style={{ color: 'var(--color-text-secondary)' }}>
                        {category.description ? `${category.description} · ` : ''}Orden: {category.displayOrder}
                      </p>
                    </div>

                    {/* The status toggle reads as a status (dot + label); delete is outlined in red. */}
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 text-sm">
                      <button
                        onClick={() => handleToggleActive(category)}
                        disabled={!canUpdate || isLoadingActive}
                        title={canUpdate ? (category.isActive ? 'Desactivar categoría' : 'Activar categoría') : undefined}
                        className={ACTION_SECONDARY_CLASS}
                        style={{ color: category.isActive ? 'var(--color-success)' : 'var(--color-warning)' }}
                      >
                        <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: 'currentColor' }} />
                        {category.isActive ? 'Activo' : 'Inactivo'}
                      </button>
                      {canUpdate && (
                        <button
                          onClick={() => handleEdit(category)}
                          className={ACTION_SECONDARY_CLASS}
                        >
                          Editar
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setCategoryToDelete(category)}
                          disabled={isDeleting}
                          className={ACTION_DANGER_CLASS}
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
        isOpen={categoryToDeactivate !== null}
        title="Desactivar categoría"
        message={`"${categoryToDeactivate?.name ?? ''}" y sus productos dejarán de mostrarse en el menú de venta. Podrás activarla de nuevo cuando quieras.`}
        confirmText="Desactivar"
        isDangerous
        isLoading={isLoadingActive}
        onConfirm={() => categoryToDeactivate && changeActive(categoryToDeactivate, false)}
        onCancel={() => setCategoryToDeactivate(null)}
      />

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
