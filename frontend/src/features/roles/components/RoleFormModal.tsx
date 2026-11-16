import { useRef, useState } from 'react'
import { sileo } from 'sileo'
import { Modal } from '../../../shared/components/Modal'
import { Button } from '../../../shared/components/Button'
import { Input } from '../../../shared/components/Input'
import { FormField } from '../../../shared/components/FormField'
import { fieldDescriptionId } from '../../../shared/utils/formField'
import { useCreateRole, useUpdateRole } from '../hooks/useRoles'
import { getErrorMessage } from '../../../shared/utils/errors'
import type { RoleData } from '../api/role.api'

interface RoleFormModalProps {
  onClose: () => void
  onSuccess?: (role: RoleData) => void
  /** The role being edited, or null to create one. */
  editingRole?: RoleData | null
}

const textareaClass =
  'min-h-20 w-full rounded-md border px-4 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-primary)_35%,transparent)]'

/** Mounted only while open and keyed by the role (see RolesView): fields start from it or empty. */
export function RoleFormModal({ onClose, onSuccess, editingRole = null }: RoleFormModalProps) {
  const isEditing = editingRole !== null
  const firstInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(editingRole?.name ?? '')
  const [description, setDescription] = useState(editingRole?.description ?? '')
  const [nameError, setNameError] = useState<string | null>(null)

  const { mutate: createRole, isPending: isCreating } = useCreateRole()
  const { mutate: updateRole, isPending: isUpdating } = useUpdateRole()
  const isSaving = isCreating || isUpdating
  // The backend doesn't allow renaming ADMIN or CAJERO (their description can change).
  const isBuiltIn = editingRole?.isSystem ?? false

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isSaving) return
    if (!name.trim()) {
      setNameError('Ingresa un nombre para el rol.')
      return
    }
    setNameError(null)

    const data = { name: name.trim(), description: description.trim() || undefined }
    const onError = (error: unknown) =>
      sileo.error({
        title: isEditing ? 'No se pudo actualizar el rol' : 'No se pudo crear el rol',
        description: getErrorMessage(error, 'Inténtalo de nuevo.'),
      })

    if (editingRole) {
      updateRole(
        { id: editingRole.id, data },
        {
          onSuccess: (response) => {
            sileo.success({ title: 'Rol actualizado', duration: 2000 })
            onSuccess?.(response.role)
          },
          onError,
        }
      )
    } else {
      createRole(data, {
        onSuccess: (response) => {
          sileo.success({ title: 'Rol creado', description: 'Ahora asígnale sus permisos.', duration: 2500 })
          onSuccess?.(response.role)
        },
        onError,
      })
    }
  }

  return (
    <Modal isOpen onClose={onClose} ariaLabelledBy="role-modal-title" initialFocusRef={firstInputRef}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4 p-6">
        <h2 id="role-modal-title" className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {isEditing ? 'Editar rol' : 'Nuevo rol'}
        </h2>

        <FormField
          htmlFor="role-name"
          label="Nombre"
          required
          error={nameError}
          hint={isBuiltIn ? 'Es un rol del sistema: su nombre no se puede cambiar.' : undefined}
        >
          <Input
            id="role-name"
            ref={firstInputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Supervisor"
            disabled={isBuiltIn}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={fieldDescriptionId('role-name')}
          />
        </FormField>

        <FormField htmlFor="role-description" label="Descripción" hint="Una línea sobre para qué sirve este rol.">
          <textarea
            id="role-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            aria-describedby={fieldDescriptionId('role-description')}
            className={textareaClass}
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
          />
        </FormField>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1" disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={isSaving} className="flex-1">
            {isSaving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear rol'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
