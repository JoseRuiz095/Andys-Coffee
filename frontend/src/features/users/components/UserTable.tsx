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
      <div className="rounded-lg border p-6" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Error al cargar usuarios</h3>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          No se pudieron cargar los usuarios. Intenta de nuevo más tarde.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--color-primary)' }}
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
            className="rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Nuevo Usuario
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
        <table className="w-full" style={{ backgroundColor: 'var(--color-surface)' }}>
          <thead className="border-b" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Nombre</th>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Email</th>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Rol</th>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Estado</th>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-primary)' }}>{user.name}</td>
                <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{user.email}</td>
                <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-primary)' }}>{user.role.name}</td>
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
                      className="hover:underline"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      Editar
                    </button>
                  )}
                  {canUpdateUsers && (
                    <button
                      onClick={() => handleToggleActive(user.id, user.isActive)}
                      disabled={isTogglingActive || user.id === currentUser?.id}
                      className="hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ color: 'var(--color-primary)' }}
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
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Página {pagination.page} de {pagination.totalPages}
          </span>
          <div className="space-x-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded border text-sm disabled:opacity-50"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
              disabled={page === pagination.totalPages}
              className="px-3 py-1 rounded border text-sm disabled:opacity-50"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
