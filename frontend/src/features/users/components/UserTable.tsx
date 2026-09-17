import { useState } from 'react'
import { Skeleton } from '@/shared/components/Skeleton'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { StatusBadge } from '@/shared/components/StatusBadge'
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
  const [search, setSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; userId: string | null; userName: string }>({
    isOpen: false,
    userId: null,
    userName: '',
  })
  const { data, isLoading, isError } = useUsersList({ page, limit: 10, search })
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

  const handleDelete = (userId: string, userName: string) => {
    if (userId === currentUser?.id) {
      sileo.error({
        title: 'No permitido',
        description: 'No puedes eliminar tu propia cuenta.',
      })
      return
    }

    setDeleteConfirm({ isOpen: true, userId, userName })
  }

  const handleConfirmDelete = () => {
    if (deleteConfirm.userId) {
      deleteUser(deleteConfirm.userId, {
        onError: (error: any) => {
          const message = error?.response?.data?.message || 'Error al eliminar usuario'
          sileo.error({ title: 'Error', description: message })
        },
        onSuccess: () => {
          setDeleteConfirm({ isOpen: false, userId: null, userName: '' })
        },
      })
    }
  }

  const handleCancelDelete = () => {
    setDeleteConfirm({ isOpen: false, userId: null, userName: '' })
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
      <div className="mb-4 flex gap-3 items-center justify-between">
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="px-4 py-2 border rounded-lg text-sm flex-1"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
          }}
        />
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

      {users.length === 0 ? (
        <div className="rounded-lg border p-8 text-center" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>No hay usuarios encontrados</p>
          {search && <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }} className="mt-1">Intenta con otros términos de búsqueda</p>}
        </div>
      ) : (
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
              <tr key={user.id} className="border-t transition-colors duration-150 hover:opacity-80" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
                <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-primary)' }}>{user.name}</td>
                <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{user.email}</td>
                <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-primary)' }}>{user.role.name}</td>
                <td className="px-4 py-3 text-sm">
                  <StatusBadge tone={user.isActive ? 'success' : 'danger'}>
                    {user.isActive ? 'Activo' : 'Inactivo'}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3 text-sm space-x-2 flex">
                  {canUpdateUsers && (
                    <button
                      onClick={() => onEditUser(user.id)}
                      className="hover:underline transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1"
                      style={{ color: 'var(--color-primary)' }}
                      aria-label={`Editar usuario ${user.name}`}
                    >
                      Editar
                    </button>
                  )}
                  {canUpdateUsers && (
                    <button
                      onClick={() => handleToggleActive(user.id, user.isActive)}
                      disabled={isTogglingActive || user.id === currentUser?.id}
                      className="hover:underline transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-1"
                      style={{ color: 'var(--color-primary)' }}
                      aria-label={`${user.isActive ? 'Desactivar' : 'Activar'} usuario ${user.name}`}
                    >
                      {user.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                  )}
                  {canDeleteUsers && (
                    <button
                      onClick={() => handleDelete(user.id, user.name)}
                      disabled={isDeleting || user.id === currentUser?.id}
                      className="text-red-600 hover:text-red-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-1"
                      aria-label={`Eliminar usuario ${user.name}`}
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
      )}

      {users.length > 0 && pagination && pagination.totalPages > 1 && (
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

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Eliminar Usuario"
        message={`¿Estás seguro de que deseas eliminar a "${deleteConfirm.userName}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        isDangerous={true}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  )
}
