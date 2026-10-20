import { useState } from 'react'
import { sileo } from 'sileo'
import { Modal } from '../../../shared/components/Modal'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { TableSkeleton } from '../../../shared/components/TableSkeleton'
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import { authStore } from '../../auth/store/auth.store'
import { hasPermission } from '../../auth/utils/permissions'
import { useExtraMutations, useExtras } from '../hooks/useExtras'
import type { Extra } from '../types/extra.types'

type FormState = { name: string; description: string; price: string; cost: string }
const EMPTY_FORM: FormState = { name: '', description: '', price: '', cost: '' }

const inputStyle = {
  borderColor: 'var(--color-border)',
  backgroundColor: 'var(--color-input-bg)',
  color: 'var(--color-input-text)',
}

/** Catalog of extras (shot, alternative milk, toppings…) that products can offer in the POS. */
export function ExtrasTab() {
  const currentUser = authStore.getState().user
  const canCreate = hasPermission(currentUser, 'products.create')
  const canUpdate = hasPermission(currentUser, 'products.update')
  const canDelete = hasPermission(currentUser, 'products.delete')

  const { data: extras = [], isLoading, error } = useExtras()
  const { save, setActive, remove } = useExtraMutations()

  const [editing, setEditing] = useState<Extra | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [toDelete, setToDelete] = useState<Extra | null>(null)

  const openForm = (extra: Extra | 'new') => {
    setEditing(extra)
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
    save.mutate(
      {
        id: editing && editing !== 'new' ? editing.id : undefined,
        input: { name: form.name.trim(), description: form.description.trim() || null, price, cost },
      },
      { onSuccess: () => setEditing(null) },
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Los extras se cobran por unidad del producto (2 lattes con un shot = 2 shots). Vincúlalos a cada producto desde su formulario.
        </p>
        {canCreate && (
          <button
            type="button"
            onClick={() => openForm('new')}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Nuevo extra
          </button>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton rows={4} columns={5} />
      ) : error ? (
        <p className="text-sm" style={{ color: 'var(--color-danger)' }}>No se pudieron cargar los extras.</p>
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
                <th className="px-4 py-3 text-left font-semibold">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {extras.map((extra) => (
                <tr key={extra.id} className="border-t" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{extra.name}</div>
                    {extra.description && <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{extra.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-right">{formatCurrency(Number(extra.price))}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(Number(extra.cost))}</td>
                  <td className="px-4 py-3 text-right">{extra._count.products}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={!canUpdate || setActive.isPending}
                      onClick={() => setActive.mutate({ id: extra.id, isActive: !extra.isActive })}
                      className="rounded-full px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: extra.isActive
                          ? 'color-mix(in srgb, var(--color-success) 15%, var(--color-surface))'
                          : 'var(--color-surface-hover)',
                        color: extra.isActive ? 'var(--color-success)' : 'var(--color-text-secondary)',
                      }}
                      title={canUpdate ? 'Cambiar estado' : undefined}
                    >
                      {extra.isActive ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {canUpdate && (
                      <button type="button" onClick={() => openForm(extra)} className="mr-3 font-medium" style={{ color: 'var(--color-primary)' }}>
                        Editar
                      </button>
                    )}
                    {canDelete && (
                      <button type="button" onClick={() => setToDelete(extra)} className="font-medium" style={{ color: 'var(--color-danger)' }}>
                        Eliminar
                      </button>
                    )}
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
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={save.isPending}
              className="flex-1 rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-50"
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
