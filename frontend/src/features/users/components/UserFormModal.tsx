import { useRef, useState } from 'react'
import { sileo } from 'sileo'
import { Modal } from '../../../shared/components/Modal'
import { Input } from '../../../shared/components/Input'
import { Select } from '../../../shared/components/Select'
import { Button } from '../../../shared/components/Button'
import { FormField } from '../../../shared/components/FormField'
import { fieldDescriptionId } from '../../../shared/utils/formField'
import { useCreateUser, useUpdateUser } from '../hooks/useUsers'
import { getErrorMessage } from '../../../shared/utils/errors'
import { PASSWORD_RULES, isValidEmail, validatePassword } from '../../../shared/utils/password'
import { isRoleAssignable } from '../../roles/utils/permissionRules'
import type { UserData } from '../api/user.api'
import type { RoleData } from '../../roles/api/role.api'
import type { AuthUser } from '../../auth/types/auth.types'

interface UserFormModalProps {
  onClose: () => void
  onSuccess?: (user: UserData) => void
  /** The user being edited (name and email only), or null to create one. */
  editingUser?: UserData | null
  roles?: RoleData[]
  currentUser: AuthUser | null
}

type FieldErrors = Partial<Record<'name' | 'email' | 'roleId' | 'password', string>>

/**
 * Mounted only while open and keyed by the edited user (see UsersView), so its fields always
 * start from that user, or empty for a new one.
 */
export function UserFormModal({ onClose, onSuccess, editingUser = null, roles = [], currentUser }: UserFormModalProps) {
  const isEditing = editingUser !== null
  const firstInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(editingUser?.name ?? '')
  const [email, setEmail] = useState(editingUser?.email ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [roleId, setRoleId] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})

  const { mutate: createUser, isPending: isCreating } = useCreateUser()
  const { mutate: updateUser, isPending: isUpdating } = useUpdateUser()
  const isSaving = isCreating || isUpdating

  const validate = (): FieldErrors => {
    const next: FieldErrors = {}
    if (!name.trim()) next.name = 'Ingresa el nombre completo.'
    if (!email.trim()) next.email = 'Ingresa el correo.'
    else if (!isValidEmail(email)) next.email = 'Revisa el formato del correo (ej. usuario@ejemplo.com).'
    if (!isEditing) {
      if (!roleId) next.roleId = 'Selecciona el rol: define lo que podrá hacer.'
      const passwordError = validatePassword(password)
      if (passwordError) next.password = passwordError
    }
    return next
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isSaving) return
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const onError = (error: unknown) =>
      sileo.error({
        title: isEditing ? 'No se pudo actualizar el usuario' : 'No se pudo crear el usuario',
        description: getErrorMessage(error, 'Inténtalo de nuevo.'),
      })

    if (editingUser) {
      updateUser(
        { id: editingUser.id, data: { name: name.trim(), email: email.trim() } },
        {
          onSuccess: (response) => {
            sileo.success({ title: 'Usuario actualizado', duration: 2000 })
            onSuccess?.(response.user)
          },
          onError,
        }
      )
    } else {
      // The password goes exactly as typed: the login doesn't trim it either.
      createUser(
        { name: name.trim(), email: email.trim(), password, roleId },
        {
          onSuccess: (response) => {
            sileo.success({ title: 'Usuario creado', description: `${response.user.name} ya puede iniciar sesión.`, duration: 2500 })
            onSuccess?.(response.user)
          },
          onError,
        }
      )
    }
  }

  const fieldProps = (field: keyof FieldErrors, id: string) => ({
    id,
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': fieldDescriptionId(id),
  })

  return (
    <Modal isOpen onClose={onClose} ariaLabelledBy="user-modal-title" initialFocusRef={firstInputRef}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4 p-6">
        <h2 id="user-modal-title" className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {isEditing ? 'Editar usuario' : 'Nuevo usuario'}
        </h2>

        <FormField htmlFor="user-name" label="Nombre completo" required error={errors.name}>
          <Input
            ref={firstInputRef}
            {...fieldProps('name', 'user-name')}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Juan Pérez"
            autoComplete="off"
          />
        </FormField>

        <FormField htmlFor="user-email" label="Correo" required error={errors.email} hint="Con este correo inicia sesión.">
          <Input
            {...fieldProps('email', 'user-email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuario@ejemplo.com"
            autoComplete="off"
          />
        </FormField>

        {!isEditing && (
          <>
            <FormField htmlFor="user-role" label="Rol" required error={errors.roleId}>
              <Select {...fieldProps('roleId', 'user-role')} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                <option value="">Selecciona un rol</option>
                {roles.map((role) => {
                  const assignable = isRoleAssignable(currentUser, role)
                  return (
                    <option key={role.id} value={role.id} disabled={!assignable}>
                      {role.name}
                      {!assignable ? ' (incluye permisos que no tienes)' : ''}
                    </option>
                  )
                })}
              </Select>
            </FormField>

            <FormField htmlFor="user-password" label="Contraseña inicial" required error={errors.password}>
              <div className="flex gap-2">
                <Input
                  {...fieldProps('password', 'user-password')}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                  className="min-h-11 shrink-0 rounded-md border px-3 text-sm font-medium transition hover:bg-[var(--color-surface-hover)]"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Requisitos de la contraseña">
                {PASSWORD_RULES.map((rule) => {
                  const met = rule.test(password)
                  return (
                    <li key={rule.id} style={{ color: met ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                      <span aria-hidden="true">{met ? '✓' : '○'}</span> {rule.label}
                      <span className="sr-only">{met ? ' (cumplido)' : ' (pendiente)'}</span>
                    </li>
                  )
                })}
              </ul>
            </FormField>
          </>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1" disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={isSaving} className="flex-1">
            {isSaving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear usuario'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
