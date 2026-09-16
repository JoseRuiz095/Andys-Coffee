import { useState } from 'react'
import { Skeleton } from '../../../shared/components/Skeleton'
import { useUsersList, useSetUserActive, useDeleteUser } from '../hooks/useUsers'
import { hasPermission } from '../../auth/utils/permissions'
import { sileo } from 'sileo'
import type { AuthUser } from '../../auth/types/auth.types'

interface UserTableProps {
  currentUser: AuthUser | null
  onEditUser: (userId: string) => void
  onCreateUser: () => void
}

export function UserTable({ currentUser, onEditUser, onCreateUser }: UserTableProps) {
  const canCreateUsers = hasPermission(currentUser, 'users.create')
  const canUpdateUsers = hasPermission(currentUser, 'users.update')
  const canDeleteUsers = hasPermission(currentUser, 'users.delete')
  const [page, setPage] = useState(1)
  const { data, isLoading, isError } = useUsersList({ page, limit: 10 })
  const { mutate: setActive, isPending: isTogglingActive } = useSetUserActive()
  const { mutate: deleteUser, isPending: isDeleting } = useDeleteUser()

  const handleToggleActive = (userId: string, isActive: boolean) => {
    if (userId === currentUser?.id) {
      sileo.error({
        title: 'No permitido',
        description: 'No puedes desactivar tu propia cuenta.',
      })
      return
    }

    setActive(
      { id: userId, isActive: !isActive },
      {
        onError: (error: any) => {
          const message = error?.response?.data?.message || 'Error al cambiar estado'
          sileo.error({ title: 'Error', description: message })
        },
      }
    )
  }

  const handleDelete = (userId: string) => {
    if (userId === currentUser?.id) {
      sileo.error({
        title: 'No permitido',
        description: 'No puedes eliminar tu propia cuenta.',
      })
      return
    }

    if (confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
      deleteUser(userId, {
        onError: (error: any) => {
          const message = error?.response?.data?.message || 'Error al eliminar usuario'
          sileo.error({ title: 'Error', description: message })
        },
      })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-6">
        <h3 className="font-semibold text-red-800">Error al cargar usuarios</h3>
        <p className="mt-2 text-sm text-red-700">
          No se pudieron cargar los usuarios. Intenta de nuevo más tarde.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const users = data?.data || []
  const pagination = data?.pagination

  return (
    <div>
      <div className="mb-4 flex justify-end">
        {canCreateUsers && (
          <button
            onClick={onCreateUser}
            className="rounded-lg bg-[#5A804F] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a6a3f]"
          >
            Nuevo Usuario
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-[#E7E3DC]">
        <table className="w-full">
          <thead className="bg-[#FDFBF7] border-b border-[#E7E3DC]">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[#2C211D]">Nombre</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[#2C211D]">Email</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[#2C211D]">Rol</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[#2C211D]">Estado</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-[#2C211D]">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-[#E7E3DC] hover:bg-[#FDFBF7]">
                <td className="px-4 py-3 text-sm text-[#2C211D]">{user.name}</td>
                <td className="px-4 py-3 text-sm text-[#6B7280]">{user.email}</td>
                <td className="px-4 py-3 text-sm text-[#2C211D]">{user.role.name}</td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      user.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {user.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm space-x-2 flex">
                  {canUpdateUsers && (
                    <button
                      onClick={() => onEditUser(user.id)}
                      className="text-[#5A804F] hover:underline"
                    >
                      Editar
                    </button>
                  )}
                  {canUpdateUsers && (
                    <button
                      onClick={() => handleToggleActive(user.id, user.isActive)}
                      disabled={isTogglingActive || user.id === currentUser?.id}
                      className="text-[#5A804F] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {user.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                  )}
                  {canDeleteUsers && (
                    <button
                      onClick={() => handleDelete(user.id)}
                      disabled={isDeleting || user.id === currentUser?.id}
                      className="text-red-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex justify-between items-center">
          <span className="text-sm text-[#6B7280]">
            Página {pagination.page} de {pagination.totalPages}
          </span>
          <div className="space-x-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded border border-[#E7E3DC] text-sm disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
              disabled={page === pagination.totalPages}
              className="px-3 py-1 rounded border border-[#E7E3DC] text-sm disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
