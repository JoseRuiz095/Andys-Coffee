import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { sileo } from 'sileo'
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
        setRoleId(editingUser.roleId)
        setPassword('')
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [editingUser, isOpen])

  useEffect(() => {
    if (isOpen) {
      firstInputRef.current?.focus()
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose()
        }
      }
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

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

    if (!roleId) {
      sileo.error({ title: 'Rol faltante', description: 'Selecciona un rol para asignar permisos al usuario.' })
      return
    }

    // Validate password only when creating
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

    const data = {
      name: name.trim(),
      email: email.trim(),
      roleId,
      ...(password && !editingUserId && { password: password.trim() }),
    }

    if (editingUserId) {
      updateUser(
        { id: editingUserId, data: { name: data.name, email: data.email, roleId: data.roleId } },
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
        { name: data.name, email: data.email, password: data.password || '', roleId: data.roleId },
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

  const handleClose = () => {
    setName('')
    setEmail('')
    setPassword('')
    setRoleId(roles[0]?.id || '')
    onClose()
  }

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { level: 0, label: '', color: '' }
    let strength = 0
    if (pwd.length >= 8) strength++
    if (pwd.length >= 12) strength++
    if (/[A-Z]/.test(pwd)) strength++
    if (/[0-9]/.test(pwd)) strength++
    if (/[^A-Za-z0-9]/.test(pwd)) strength++

    if (strength <= 1) return { level: 1, label: 'Débil', color: 'bg-red-500' }
    if (strength <= 2) return { level: 2, label: 'Regular', color: 'bg-yellow-500' }
    if (strength <= 3) return { level: 3, label: 'Buena', color: 'bg-blue-500' }
    return { level: 4, label: 'Fuerte', color: 'bg-green-500' }
  }

  const passwordStrength = !editingUserId ? getPasswordStrength(password) : { level: 0, label: '', color: '' }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <motion.div
        className="w-full max-w-md rounded-lg shadow-lg"
        style={{ backgroundColor: 'var(--color-surface)' }}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-modal-title"
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <h2 id="user-modal-title" className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {editingUserId ? 'Editar Usuario' : 'Crear Usuario'}
          </h2>

          {/* Nombre */}
          <div>
            <label htmlFor="user-name" className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Nombre *</label>
            <input
              id="user-name"
              ref={firstInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Juan Pérez"
              aria-label="Nombre del usuario"
              aria-required="true"
              className="w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)]/20"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)'
              }}
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="user-email" className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Email *</label>
            <input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              aria-label="Email del usuario"
              aria-required="true"
              className="w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)]/20"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)'
              }}
            />
          </div>

          {/* Rol */}
          <div>
            <label htmlFor="user-role" className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Rol *</label>
            <select
              id="user-role"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              aria-label="Rol del usuario"
              aria-required="true"
              className="w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)]/20"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)'
              }}
            >
              <option value="">Selecciona un rol</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>

          {/* Password (solo al crear) */}
          {!editingUserId && (
            <div>
              <label htmlFor="user-password" className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Contraseña *</label>
              <input
                id="user-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mín. 8 caracteres, 1 letra, 1 número"
                aria-label="Contraseña del usuario"
                aria-required="true"
                className="w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-[var(--color-primary)]/20"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-primary)'
                }}
              />
              {password && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded ${
                          i <= passwordStrength.level ? passwordStrength.color : 'bg-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    Fortaleza: <span className={`font-semibold ${passwordStrength.color.replace('bg-', 'text-')}`}>{passwordStrength.label}</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:opacity-80"
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isCreating || isUpdating}
              className="flex-1 rounded-lg bg-[#5A804F] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a6a3f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating || isUpdating ? (editingUserId ? 'Actualizando...' : 'Creando...') : (editingUserId ? 'Actualizar' : 'Crear')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
