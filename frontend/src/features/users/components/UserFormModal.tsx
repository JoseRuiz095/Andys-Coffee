import { useState, useEffect } from 'react'
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      sileo.error({ title: 'Nombre requerido', description: 'Ingresa un nombre para el usuario.' })
      return
    }

    if (!email.trim()) {
      sileo.error({ title: 'Email requerido', description: 'Ingresa un email para el usuario.' })
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      sileo.error({ title: 'Email inválido', description: 'Ingresa un email válido.' })
      return
    }

    if (!roleId) {
      sileo.error({ title: 'Rol requerido', description: 'Selecciona un rol para el usuario.' })
      return
    }

    // Validate password only when creating
    if (!editingUserId) {
      if (!password.trim()) {
        sileo.error({ title: 'Contraseña requerida', description: 'Ingresa una contraseña.' })
        return
      }
      const passwordError = validatePassword(password.trim())
      if (passwordError) {
        sileo.error({ title: 'Contraseña inválida', description: passwordError })
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <motion.div
        className="w-full max-w-md rounded-lg bg-white shadow-lg"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {editingUserId ? 'Editar Usuario' : 'Crear Usuario'}
          </h2>

          {/* Nombre */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nombre *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Juan Pérez"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-[#5A804F] focus:ring-2 focus:ring-[#5A804F]/20"
            />
          </div>

          {/* Email */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-[#5A804F] focus:ring-2 focus:ring-[#5A804F]/20"
            />
          </div>

          {/* Rol */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Rol *</label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-[#5A804F] focus:ring-2 focus:ring-[#5A804F]/20"
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
              <label className="mb-1 block text-sm font-medium text-gray-700">Contraseña *</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mín. 8 caracteres, 1 letra, 1 número"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-[#5A804F] focus:ring-2 focus:ring-[#5A804F]/20"
              />
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isCreating || isUpdating}
              className="flex-1 rounded-lg bg-[#5A804F] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a6a3f] disabled:opacity-50"
            >
              {isCreating || isUpdating ? (editingUserId ? 'Actualizando...' : 'Creando...') : (editingUserId ? 'Actualizar' : 'Crear')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
