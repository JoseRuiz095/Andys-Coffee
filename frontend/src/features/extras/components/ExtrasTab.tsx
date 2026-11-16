import { useState } from 'react'
import { sileo } from 'sileo'
import { Modal } from '../../../shared/components/Modal'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { TableSkeleton } from '../../../shared/components/TableSkeleton'
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import { hasPermission } from '../../auth/utils/permissions'
import { useExtraMutations, useExtras } from '../hooks/useExtras'
import type { Extra } from '../types/extra.types'
import { RecipeEditor } from '../../products/components/RecipeEditor'
import type { RecipeDraftRow } from '../../products/types/recipe.types'
import { recipeCost, recipeRowsError, rowsFromRecipe, rowsToInput } from '../../products/utils/recipeDraft'
import { useInventoryUnits } from '../../inventory/hooks/useInventory'
import { useCurrentUser } from '../../auth/hooks/useCurrentUser'
import { PageHeader } from '../../../shared/components/PageHeader'
import { QueryErrorState } from '../../../shared/components/QueryErrorState'
import { StatusBadge } from '../../../shared/components/StatusBadge'
import { RowActions } from '../../../shared/components/RowActions'

type FormState = { name: string; description: string; price: string; cost: string }
const EMPTY_FORM: FormState = { name: '', description: '', price: '', cost: '' }

const inputStyle = {
  borderColor: 'var(--color-border)',
  backgroundColor: 'var(--color-input-bg)',
  color: 'var(--color-input-text)',
}

/** Catalog of extras (shot, alternative milk, toppings…) that products can offer in the POS. */
export function ExtrasTab() {
  const currentUser = useCurrentUser()
  const canCreate = hasPermission(currentUser, 'products.create')
  const canUpdate = hasPermission(currentUser, 'products.update')
  const canDelete = hasPermission(currentUser, 'products.delete')
  const canManageRecipes = hasPermission(currentUser, 'inventory.manage_recipes')
  const { data: units } = useInventoryUnits()
  const [recipeRows, setRecipeRows] = useState<RecipeDraftRow[]>([])

  const { data: extras = [], isLoading, error } = useExtras()
  const { save, setActive, remove } = useExtraMutations()

  const [editing, setEditing] = useState<Extra | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [toDelete, setToDelete] = useState<Extra | null>(null)
  // Deactivating removes the extra from the POS: it is confirmed first.
  const [toDeactivate, setToDeactivate] = useState<Extra | null>(null)
  const togglingId = setActive.isPending ? setActive.variables?.id ?? null : null

  const openForm = (extra: Extra | 'new') => {
    setEditing(extra)
    setRecipeRows(extra === 'new' ? [] : rowsFromRecipe(extra.recipe))
    setForm(extra === 'new'
      ? EMPTY_FORM
      : { name: extra.name, description: extra.description ?? '', price: String(Number(extra.price)), cost: String(Number(extra.cost)) })
  }
  const closeForm = () => {
    if (save.isPending) return
    setEditing(null)
  }

  const handleSave = () => {
    const price = Number(form.price)
    const cost = Number(form.cost)
    if (form.name.trim().length < 2 || form.price === '' || form.cost === '' || !(price >= 0) || !(cost >= 0)) {
      sileo.error({ title: 'Revisa el formulario', description: 'Nombre, precio y costo son obligatorios (precio y costo ≥ 0).' })
      return
    }
    const recipeError = canManageRecipes ? recipeRowsError(recipeRows, true) : null
    if (recipeError) {
      sileo.error({ title: 'Revisa la receta', description: recipeError })
      return
    }
    save.mutate(
      {
        id: editing && editing !== 'new' ? editing.id : undefined,
        input: {
          name: form.name.trim(),
          description: form.description.trim() || null,
          price,
          cost,
          ...(canManageRecipes && { recipe: rowsToInput(recipeRows) }),
        },
      },
      { onSuccess: () => setEditing(null) },
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Extras"
        description="Se cobran por unidad del producto (2 lattes con un shot = 2 shots). Vincúlalos desde el formulario de cada producto."
        actions={
          canCreate && (
            <button
              type="button"
              onClick={() => openForm('new')}
              className="min-h-10 rounded-lg px-4 text-sm font-semibold text-[var(--color-button-text)] transition hover:bg-[var(--color-primary-hover)]"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              + Nuevo extra
            </button>
          )
        }
      />

      {isLoading ? (
        <TableSkeleton rows={4} columns={5} />
      ) : error ? (
        <QueryErrorState error={error} subject="los extras" />
      ) : extras.length === 0 ? (
        <p className="rounded-xl border p-6 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
          Aún no hay extras. Crea uno para ofrecerlo con tus productos.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)' }}>
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Extra</th>
                <th className="px-4 py-3 text-right font-semibold">Precio</th>
                <th className="px-4 py-3 text-right font-semibold">Costo</th>
                <th className="px-4 py-3 text-right font-semibold">Productos</th>
                <th className="px-4 py-3 text-center font-semibold">Estado</th>
                <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {extras.map((extra) => (
                <tr key={extra.id} className="border-t transition-colors hover:bg-[var(--color-surface-hover)]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{extra.name}</div>
                    {extra.description && <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{extra.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-right">{formatCurrency(Number(extra.price))}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(Number(extra.cost))}</td>
                  <td className="px-4 py-3 text-right">{extra._count.products}</td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge tone={extra.isActive ? 'success' : 'neutral'}>{extra.isActive ? 'Activo' : 'Inactivo'}</StatusBadge>
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      actions={[
                        ...(canUpdate
                          ? [
                              { label: 'Editar', ariaLabel: `Editar ${extra.name}`, onClick: () => openForm(extra) },
                              {
                                label: togglingId === extra.id ? 'Cambiando...' : extra.isActive ? 'Desactivar' : 'Activar',
                                ariaLabel: `${extra.isActive ? 'Desactivar' : 'Activar'} ${extra.name}`,
                                onClick: () => (extra.isActive ? setToDeactivate(extra) : setActive.mutate({ id: extra.id, isActive: true })),
                                disabled: setActive.isPending,
                              },
                            ]
                          : []),
                        ...(canDelete
                          ? [{ label: 'Eliminar', ariaLabel: `Eliminar ${extra.name}`, onClick: () => setToDelete(extra), danger: true }]
                          : []),
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={editing !== null} onClose={closeForm} ariaLabelledBy="extra-modal-title" maxWidthClassName="max-w-md">
        <div className="space-y-4 p-6">
          <h2 id="extra-modal-title" className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {editing === 'new' ? 'Nuevo extra' : 'Editar extra'}
          </h2>
          <label className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Nombre *
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              maxLength={80}
              placeholder="Ej. Shot de espresso"
              className="mt-1 w-full rounded-lg border px-4 py-2 font-normal"
              style={inputStyle}
            />
          </label>
          <label className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Descripción
            <input
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              maxLength={300}
              className="mt-1 w-full rounded-lg border px-4 py-2 font-normal"
              style={inputStyle}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Precio *
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(event) => setForm({ ...form, price: event.target.value })}
                className="mt-1 w-full rounded-lg border px-4 py-2 font-normal"
                style={inputStyle}
              />
            </label>
            <label className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Costo *
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.cost}
                onChange={(event) => setForm({ ...form, cost: event.target.value })}
                className="mt-1 w-full rounded-lg border px-4 py-2 font-normal"
                style={inputStyle}
              />
            </label>
          </div>
          <fieldset className="space-y-2 rounded-lg border p-3" style={{ borderColor: 'var(--color-border)' }}>
            <legend className="px-1 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Receta del extra (por unidad del producto)
            </legend>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Cantidad positiva = agrega el insumo; negativa = lo quita (ej. "Sin azúcar" o sustituir leche).
            </p>
            <RecipeEditor rows={recipeRows} onChange={setRecipeRows} allowNegative readOnly={!canManageRecipes} />
            {canManageRecipes && recipeRows.length > 0 && recipeCost(recipeRows, units) !== Number(form.cost || 0) && (
              <button
                type="button"
                onClick={() => setForm({ ...form, cost: String(Math.max(0, recipeCost(recipeRows, units))) })}
                className="text-xs font-semibold underline"
                style={{ color: 'var(--color-primary)' }}
              >
                Usar el costo de la receta como costo
              </button>
            )}
          </fieldset>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={save.isPending}
              className="flex-1 rounded-lg px-4 py-2 font-semibold text-[var(--color-button-text)] disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {save.isPending ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              disabled={save.isPending}
              className="flex-1 rounded-lg border px-4 py-2 font-semibold"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={toDeactivate !== null}
        title="Desactivar extra"
        message={`"${toDeactivate?.name ?? ''}" dejará de ofrecerse en el punto de venta. Podrás activarlo de nuevo cuando quieras.`}
        confirmText="Desactivar"
        isDangerous
        isLoading={setActive.isPending}
        onConfirm={() => toDeactivate && setActive.mutate({ id: toDeactivate.id, isActive: false }, { onSettled: () => setToDeactivate(null) })}
        onCancel={() => setToDeactivate(null)}
      />

      <ConfirmDialog
        isOpen={toDelete !== null}
        title="Eliminar extra"
        message={`¿Eliminar "${toDelete?.name ?? ''}"? Si ya se vendió no podrá eliminarse; en ese caso desactívalo.`}
        confirmText="Eliminar"
        isDangerous
        isLoading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id, { onSettled: () => setToDelete(null) })}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
