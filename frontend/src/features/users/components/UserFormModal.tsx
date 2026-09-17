import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { sileo } from 'sileo'
import { Modal } from '../../../shared/components/Modal'
import { Input } from '../../../shared/components/Input'
import { Select } from '../../../shared/components/Select'
import { Button } from '../../../shared/components/Button'
import { useCreateUser, useUpdateUser, useUserById } from '../hooks/useUsers'

interface UserFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (user: any) => void
  editingUserId?: string | null
  roles?: Array<{ id: string; name: string }>
}

const PASSWORD_MIN_LENGTH = 8
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`
  }
  if (!PASSWORD_PATTERN.test(password)) {
    return 'La contraseña debe contener al menos una letra y un número.'
  }
  return null
}

export function UserFormModal({
  isOpen,
  onClose,
  onSuccess,
  editingUserId = null,
  roles = [],
}: UserFormModalProps) {
  const firstInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [roleId, setRoleId] = useState(roles[0]?.id || '')

  const { data: editingUser } = useUserById(editingUserId || '')
  const { mutate: createUser, isPending: isCreating } = useCreateUser()
  const { mutate: updateUser, isPending: isUpdating } = useUpdateUser()

  useEffect(() => {
    if (editingUser && isOpen) {
      const timer = setTimeout(() => {
        setName(editingUser.name)
        setEmail(editingUser.email)
        setPassword('')
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [editingUser, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      sileo.error({ title: 'Campo vacío', description: 'Por favor ingresa el nombre completo del usuario.' })
      return
    }

    if (!email.trim()) {
      sileo.error({ title: 'Campo vacío', description: 'Por favor ingresa un correo electrónico válido.' })
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      sileo.error({ title: 'Email inválido', description: 'Verifica que el email tenga el formato correcto (ej: usuario@ejemplo.com).' })
      return
    }

    if (!editingUserId && !roleId) {
      sileo.error({ title: 'Rol faltante', description: 'Selecciona un rol para asignar permisos al usuario.' })
      return
    }

    if (!editingUserId) {
      if (!password.trim()) {
        sileo.error({ title: 'Contraseña requerida', description: 'Ingresa una contraseña segura de al menos 8 caracteres.' })
        return
      }
      const passwordError = validatePassword(password.trim())
      if (passwordError) {
        sileo.error({ title: 'Contraseña débil', description: passwordError })
        return
      }
    }

    if (editingUserId) {
      updateUser(
        { id: editingUserId, data: { name: name.trim(), email: email.trim() } },
        {
          onSuccess: (response) => {
            sileo.success({ title: 'Usuario actualizado', duration: 2000 })
            onSuccess?.(response.user)
            handleClose()
          },
          onError: (error: any) => {
            const message =
              error?.response?.data?.message || error?.message || 'Error actualizando usuario'
            sileo.error({ title: 'Error', description: message })
          },
        }
      )
    } else {
      createUser(
        { name: name.trim(), email: email.trim(), password: password.trim(), roleId },
        {
          onSuccess: (response) => {
            sileo.success({ title: 'Usuario creado', duration: 2000 })
            onSuccess?.(response.user)
            handleClose()
          },
          onError: (error: any) => {
            const message =
              error?.response?.data?.message || error?.message || 'Error creando usuario'
            sileo.error({ title: 'Error', description: message })
          },
        }
      )
    }
  }

  const handleClose = useCallback(() => {
    setName('')
    setEmail('')
    setPassword('')
    setRoleId('')
    onClose()
  }, [onClose])

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { level: 0, label: '', colorVar: '' }
    let strength = 0
    if (pwd.length >= 8) strength++
    if (pwd.length >= 12) strength++
    if (/[A-Z]/.test(pwd)) strength++
    if (/[0-9]/.test(pwd)) strength++
    if (/[^A-Za-z0-9]/.test(pwd)) strength++

    if (strength <= 1) return { level: 1, label: 'Débil', colorVar: 'var(--color-danger)' }
    if (strength <= 2) return { level: 2, label: 'Regular', colorVar: 'var(--color-warning)' }
    if (strength <= 3) return { level: 3, label: 'Buena', colorVar: 'var(--color-info)' }
    return { level: 4, label: 'Fuerte', colorVar: 'var(--color-success)' }
  }

  const passwordStrength = !editingUserId ? getPasswordStrength(password) : { level: 0, label: '', colorVar: '' }

  const modalContent = (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      ariaLabelledBy="user-modal-title"
      initialFocusRef={firstInputRef}
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        <h2 id="user-modal-title" className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {editingUserId ? 'Editar Usuario' : 'Crear Usuario'}
        </h2>

        <div>
          <label htmlFor="user-name" className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Nombre *
          </label>
          <input
            id="user-name"
            ref={firstInputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Juan Pérez"
            aria-required="true"
            className="min-h-11 w-full min-w-0 rounded-md border px-4 text-xs outline-none transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              boxShadow: 'none',
            }}
          />
        </div>

        <div>
          <label htmlFor="user-email" className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Email *
          </label>
          <Input
            id="user-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuario@ejemplo.com"
            aria-required="true"
          />
        </div>

        {!editingUserId && (
          <div>
            <label htmlFor="user-role" className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Rol *
            </label>
            <Select
              id="user-role"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              aria-required="true"
            >
              <option value="">Selecciona un rol</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        {!editingUserId && (
          <div>
            <label htmlFor="user-password" className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Contraseña *
            </label>
            <Input
              id="user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mín. 8 caracteres, 1 letra, 1 número"
              aria-required="true"
            />
            {password && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-1 flex-1 rounded"
                      style={{
                        backgroundColor: i <= passwordStrength.level ? passwordStrength.colorVar : 'var(--color-border)',
                      }}
                    />
                  ))}
                </div>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  Fortaleza: <span style={{ fontWeight: 'semibold', color: passwordStrength.colorVar }}>{passwordStrength.label}</span>
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={handleClose} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={isCreating || isUpdating} className="flex-1">
            {isCreating || isUpdating ? (editingUserId ? 'Actualizando...' : 'Creando...') : (editingUserId ? 'Actualizar' : 'Crear')}
          </Button>
        </div>
      </form>
    </Modal>
  )

  const portalRoot = document.getElementById('modal-root')
  if (!portalRoot) return modalContent

  return createPortal(modalContent, portalRoot)
}
