import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { sileo } from 'sileo'
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

  const handleClose = () => {
    setName('')
    setDescription('')
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
            {editingRoleId ? 'Editar Rol' : 'Crear Rol'}
          </h2>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nombre *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Supervisor"
              disabled={isBuiltIn}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-[#5A804F] focus:ring-2 focus:ring-[#5A804F]/20 disabled:bg-gray-100 disabled:text-gray-500"
            />
            {isBuiltIn && (
              <p className="mt-1 text-xs text-gray-500">No se puede renombrar un rol del sistema.</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del rol"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-[#5A804F] focus:ring-2 focus:ring-[#5A804F]/20"
            />
          </div>

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
              {isCreating || isUpdating ? (editingRoleId ? 'Actualizando...' : 'Creando...') : (editingRoleId ? 'Actualizar' : 'Crear')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
