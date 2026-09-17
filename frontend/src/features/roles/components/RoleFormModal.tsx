import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { sileo } from 'sileo'
import { Modal } from '../../../shared/components/Modal'
import { Button } from '../../../shared/components/Button'
import { useCreateRole, useUpdateRole, useRoleById } from '../hooks/useRoles'

interface RoleFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (role: any) => void
  editingRoleId?: string | null
}

export function RoleFormModal({
  isOpen,
  onClose,
  onSuccess,
  editingRoleId = null,
}: RoleFormModalProps) {
  const firstInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const { data: editingRole } = useRoleById(editingRoleId || '')
  const { mutate: createRole, isPending: isCreating } = useCreateRole()
  const { mutate: updateRole, isPending: isUpdating } = useUpdateRole()

  useEffect(() => {
    if (editingRole && isOpen) {
      const timer = setTimeout(() => {
        setName(editingRole.name)
        setDescription(editingRole.description || '')
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [editingRole, isOpen])

  const isBuiltIn = editingRole?.isSystem ?? false

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      sileo.error({ title: 'Nombre requerido', description: 'Ingresa un nombre para el rol.' })
      return
    }

    const data = {
      name: name.trim(),
      description: description.trim() || undefined,
    }

    if (editingRoleId) {
      updateRole(
        { id: editingRoleId, data },
        {
          onSuccess: (response) => {
            sileo.success({ title: 'Rol actualizado', duration: 2000 })
            onSuccess?.(response.role)
            handleClose()
          },
          onError: (error: any) => {
            const message =
              error?.response?.data?.message || error?.message || 'Error actualizando rol'
            sileo.error({ title: 'Error', description: message })
          },
        }
      )
    } else {
      createRole(data, {
        onSuccess: (response) => {
          sileo.success({ title: 'Rol creado', duration: 2000 })
          onSuccess?.(response.role)
          handleClose()
        },
        onError: (error: any) => {
          const message = error?.response?.data?.message || error?.message || 'Error creando rol'
          sileo.error({ title: 'Error', description: message })
        },
      })
    }
  }

  const handleClose = useCallback(() => {
    setName('')
    setDescription('')
    onClose()
  }, [onClose])

  const modalContent = (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      ariaLabelledBy="role-modal-title"
      initialFocusRef={firstInputRef}
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        <h2 id="role-modal-title" className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {editingRoleId ? 'Editar Rol' : 'Crear Rol'}
        </h2>

        <div>
          <label htmlFor="role-name" className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Nombre *
          </label>
          <input
            id="role-name"
            ref={firstInputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Supervisor"
            disabled={isBuiltIn}
            aria-required="true"
            className="min-h-11 w-full min-w-0 rounded-md border px-4 text-xs outline-none transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              boxShadow: 'none',
            }}
          />
          {isBuiltIn && (
            <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              No se puede renombrar un rol del sistema.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="role-description" className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Descripción
          </label>
          <textarea
            id="role-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción del rol"
            rows={3}
            className="w-full min-h-20 rounded-md border px-4 text-xs outline-none transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              boxShadow: 'none',
            }}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={handleClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isCreating || isUpdating}
            className="flex-1"
          >
            {isCreating || isUpdating ? (editingRoleId ? 'Actualizando...' : 'Creando...') : (editingRoleId ? 'Actualizar' : 'Crear')}
          </Button>
        </div>
      </form>
    </Modal>
  )

  const portalRoot = document.getElementById('modal-root')
  if (!portalRoot) return modalContent

  return createPortal(modalContent, portalRoot)
}
