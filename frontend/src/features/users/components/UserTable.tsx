import { useState } from 'react'
import { Skeleton } from '../../../shared/components/Skeleton'
import { Input } from '../../../shared/components/Input'
import { Button } from '../../../shared/components/Button'
import { StatusBadge } from '../../../shared/components/StatusBadge'
import { ActionMenu } from '../../../shared/components/ActionMenu'
import { Card } from '../../../shared/components/Card'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { useUsersList, useSetUserActive } from '../hooks/useUsers'
import { hasPermission } from '../../auth/utils/permissions'
import { blockIfSelf } from '../utils/selfGuard'
import { getErrorMessage } from '../../../shared/utils/errors'
import { sileo } from 'sileo'
import type { UserData } from '../api/user.api'
import type { AuthUser } from '../../auth/types/auth.types'

export type UserRowIntent = 'view' | 'changeRole'

interface UserTableProps {
  currentUser: AuthUser | null
  onSelectUser: (userId: string, intent: UserRowIntent) => void
}

/**
 * Clean Usuario | Correo | Rol | Estado | Acciones table. Deleting a user is
 * a heavier, less frequent action, so it is deliberately not offered here —
 * it only lives inside the user's detail drawer, reached via "Ver / editar".
 */
export function UserTable({ currentUser, onSelectUser }: UserTableProps) {
  const canUpdateUsers = hasPermission(currentUser, 'users.update')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [deactivateTarget, setDeactivateTarget] = useState<UserData | null>(null)
  const { data, isLoading, isError } = useUsersList({ page, limit: 10, search })
  const { mutate: setActive, isPending: isTogglingActive } = useSetUserActive()

  const handleToggleActive = (user: UserData) => {
    if (user.isActive) {
      if (blockIfSelf(currentUser, user.id, 'desactivar')) return
      setDeactivateTarget(user)
      return
    }
    setActive(
      { id: user.id, isActive: true },
      {
        onError: (error: unknown) => {
          sileo.error({ title: 'Error', description: getErrorMessage(error, 'Error al activar usuario') })
        },
      }
    )
  }

  const handleConfirmDeactivate = () => {
    if (!deactivateTarget) return
    setActive(
      { id: deactivateTarget.id, isActive: false },
      {
        onError: (error: unknown) => {
          sileo.error({ title: 'Error', description: getErrorMessage(error, 'Error al desactivar usuario') })
        },
      }
    )
    setDeactivateTarget(null)
  }

  const getRowActions = (user: UserData) => [
    { label: 'Ver / editar', onClick: () => onSelectUser(user.id, 'view') },
    ...(canUpdateUsers ? [{ label: 'Cambiar rol', onClick: () => onSelectUser(user.id, 'changeRole') }] : []),
    ...(canUpdateUsers
      ? [{
          label: user.isActive ? 'Desactivar' : 'Activar',
          onClick: () => handleToggleActive(user),
          disabled: isTogglingActive,
        }]
      : []),
  ]

  return (
    <div className="space-y-4">
      <Input
        type="text"
        placeholder="Buscar por nombre o correo..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setPage(1)
        }}
      />

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : isError ? (
        <Card variant="inset">
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            No se pudieron cargar los usuarios. Intenta de nuevo más tarde.
          </p>
        </Card>
      ) : !data || data.data.length === 0 ? (
        <Card variant="inset">
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            No se encontraron usuarios
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {search ? 'Intenta buscar con otro nombre o correo.' : 'Aún no hay usuarios registrados.'}
          </p>
        </Card>
      ) : (
        <>
          {/* Desktop / tablet table */}
          <div className="hidden rounded-lg border md:block" style={{ borderColor: 'var(--color-border)' }}>
            <table className="w-full" style={{ backgroundColor: 'var(--color-surface)' }}>
              <thead className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
                    Usuario
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
                    Correo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
                    Rol
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((user) => (
                  <tr key={user.id} className="border-t h-14" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="px-4 py-3 text-sm align-middle">
                      <button
                        type="button"
                        onClick={() => onSelectUser(user.id, 'view')}
                        className="truncate max-w-48 text-left font-medium hover:underline"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {user.name}
                      </button>
                    </td>
                    <td className="truncate max-w-64 px-4 py-3 text-sm align-middle" style={{ color: 'var(--color-text-secondary)' }}>
                      {user.email}
                    </td>
                    <td className="truncate max-w-48 px-4 py-3 text-sm align-middle" style={{ color: 'var(--color-text-secondary)' }}>
                      {user.role.name}
                    </td>
                    <td className="px-4 py-3 text-sm align-middle">
                      <StatusBadge tone={user.isActive ? 'success' : 'danger'}>
                        {user.isActive ? 'Activo' : 'Inactivo'}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-right align-middle">
                      <ActionMenu ariaLabel={`Acciones para ${user.name}`} items={getRowActions(user)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile stacked rows */}
          <div className="space-y-2 md:hidden">
            {data.data.map((user) => (
              <Card key={user.id} variant="inset">
                <div className="flex items-start justify-between gap-3">
                  <button type="button" onClick={() => onSelectUser(user.id, 'view')} className="text-left">
                    <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{user.name}</p>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{user.email}</p>
                  </button>
                  <ActionMenu ariaLabel={`Acciones para ${user.name}`} items={getRowActions(user)} />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{user.role.name}</span>
                  <StatusBadge tone={user.isActive ? 'success' : 'danger'}>
                    {user.isActive ? 'Activo' : 'Inactivo'}
                  </StatusBadge>
                </div>
              </Card>
            ))}
          </div>

          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Página {data.pagination.page} de {data.pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  Anterior
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                  disabled={page === data.pagination.totalPages}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={!!deactivateTarget}
        title="Desactivar usuario"
        message={`¿Estás seguro de que deseas desactivar a "${deactivateTarget?.name}"? Podrá reactivarse después.`}
        confirmText="Desactivar"
        cancelText="Cancelar"
        isDangerous
        onConfirm={handleConfirmDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />
    </div>
  )
}
