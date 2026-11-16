import { useState } from 'react'
import { sileo } from 'sileo'
import { TableSkeleton } from '../../../shared/components/TableSkeleton'
import { StatusBadge } from '../../../shared/components/StatusBadge'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { FilterBar } from '../../../shared/components/FilterBar'
import { RowActions, type RowAction } from '../../../shared/components/RowActions'
import { Pagination } from '../../../shared/components/Pagination'
import { QueryErrorState } from '../../../shared/components/QueryErrorState'
import { FILTER_FIELD_CLASS } from '../../../shared/constants/fieldStyles'
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue'
import { useUsersList, useSetUserActive } from '../hooks/useUsers'
import { useRolesList } from '../../roles/hooks/useRoles'
import { hasPermission } from '../../auth/utils/permissions'
import { isRoleAssignable } from '../../roles/utils/permissionRules'
import { getErrorMessage } from '../../../shared/utils/errors'
import type { UserData } from '../api/user.api'
import type { AuthUser } from '../../auth/types/auth.types'

export type UserRowIntent = 'view' | 'changeRole'

interface UserTableProps {
  currentUser: AuthUser | null
  onSelectUser: (userId: string, intent: UserRowIntent) => void
}

const PAGE_SIZE = 10
type StatusFilter = '' | 'active' | 'inactive'

/**
 * Usuario | Rol | Estado | Acciones. Deleting a user is a heavier, less frequent action, so it
 * only lives inside the user's detail drawer. Your own account offers no role change nor
 * deactivation: the backend rejects both.
 */
export function UserTable({ currentUser, onSelectUser }: UserTableProps) {
  const canUpdateUsers = hasPermission(currentUser, 'users.update')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleId, setRoleId] = useState('')
  const [status, setStatus] = useState<StatusFilter>('')
  const debouncedSearch = useDebouncedValue(search.trim(), 300)
  const [deactivateTarget, setDeactivateTarget] = useState<UserData | null>(null)

  const { data: roles } = useRolesList()
  const { data, isLoading, isError, error, refetch, isFetching } = useUsersList({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    roleId: roleId || undefined,
    isActive: status === '' ? undefined : status === 'active',
  })
  const { mutate: setActive, isPending: isTogglingActive, variables: toggling } = useSetUserActive()

  const hasFilters = search !== '' || roleId !== '' || status !== ''
  const withFirstPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value)
    setPage(1)
  }

  const activate = (user: UserData) =>
    setActive(
      { id: user.id, isActive: true },
      {
        onSuccess: () => sileo.success({ title: 'Usuario activado', description: `${user.name} puede volver a iniciar sesión.` }),
        onError: (err: unknown) =>
          sileo.error({ title: 'No se pudo activar el usuario', description: getErrorMessage(err, 'Inténtalo de nuevo.') }),
      }
    )

  const handleConfirmDeactivate = () => {
    if (!deactivateTarget) return
    const target = deactivateTarget
    setActive(
      { id: target.id, isActive: false },
      {
        onSuccess: () => {
          setDeactivateTarget(null)
          sileo.success({ title: 'Usuario desactivado', description: `${target.name} ya no puede iniciar sesión.` })
        },
        onError: (err: unknown) =>
          sileo.error({ title: 'No se pudo desactivar el usuario', description: getErrorMessage(err, 'Inténtalo de nuevo.') }),
      }
    )
  }

  // A1: the backend only lets you manage users whose role you fully cover.
  const coversRoleOf = (user: UserData) => {
    const role = roles?.find((r) => r.id === user.roleId)
    return role ? isRoleAssignable(currentUser, role) : false
  }

  const getRowActions = (user: UserData): RowAction[] => {
    const isSelf = currentUser?.id === user.id
    const isTogglingThis = isTogglingActive && toggling?.id === user.id
    return [
      { label: 'Ver detalle', ariaLabel: `Ver detalle de ${user.name}`, onClick: () => onSelectUser(user.id, 'view') },
      ...(canUpdateUsers && !isSelf && coversRoleOf(user)
        ? [
            { label: 'Cambiar rol', ariaLabel: `Cambiar rol de ${user.name}`, onClick: () => onSelectUser(user.id, 'changeRole') },
            {
              label: isTogglingThis ? 'Cambiando...' : user.isActive ? 'Desactivar' : 'Activar',
              ariaLabel: `${user.isActive ? 'Desactivar' : 'Activar'} a ${user.name}`,
              onClick: () => (user.isActive ? setDeactivateTarget(user) : activate(user)),
              disabled: isTogglingActive,
            },
          ]
        : []),
    ]
  }

  return (
    <div>
      <FilterBar
        hasFilters={hasFilters}
        onClear={() => {
          setSearch('')
          setRoleId('')
          setStatus('')
          setPage(1)
        }}
      >
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          Buscar
          <input
            type="search"
            value={search}
            onChange={(e) => withFirstPage(setSearch)(e.target.value)}
            placeholder="Nombre o correo"
            className={FILTER_FIELD_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          Rol
          <select value={roleId} onChange={(e) => withFirstPage(setRoleId)(e.target.value)} className={FILTER_FIELD_CLASS}>
            <option value="">Todos</option>
            {roles?.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          Estado
          <select
            value={status}
            onChange={(e) => withFirstPage(setStatus)(e.target.value as StatusFilter)}
            className={FILTER_FIELD_CLASS}
          >
            <option value="">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </label>
      </FilterBar>

      {isLoading ? (
        <TableSkeleton rows={5} columns={4} />
      ) : isError ? (
        <QueryErrorState error={error} subject="los usuarios" onRetry={() => void refetch()} isRetrying={isFetching} />
      ) : !data || data.data.length === 0 ? (
        <div className="rounded-xl border px-4 py-8 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
          {hasFilters ? 'Ningún usuario coincide con los filtros.' : 'Aún no hay usuarios registrados.'}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
            <table className="w-full text-sm" style={{ backgroundColor: 'var(--color-surface)' }}>
              <thead style={{ color: 'var(--color-text-secondary)' }}>
                <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <th className="px-4 py-3 text-left font-semibold">Usuario</th>
                  <th className="px-4 py-3 text-left font-semibold">Rol</th>
                  <th className="px-4 py-3 text-left font-semibold">Estado</th>
                  <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((user) => (
                  <tr
                    key={user.id}
                    className="border-t transition-colors hover:bg-[var(--color-surface-hover)]"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <td className="px-4 py-3 align-middle">
                      <button
                        type="button"
                        onClick={() => onSelectUser(user.id, 'view')}
                        className="max-w-64 truncate text-left font-medium hover:underline"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {user.name}
                        {currentUser?.id === user.id && (
                          <span className="ml-2 text-xs font-normal" style={{ color: 'var(--color-text-secondary)' }}>
                            (tú)
                          </span>
                        )}
                      </button>
                      <p className="max-w-64 truncate" style={{ color: 'var(--color-text-secondary)' }}>
                        {user.email}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-middle" style={{ color: 'var(--color-text-primary)' }}>
                      {user.role.name}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <StatusBadge tone={user.isActive ? 'success' : 'neutral'}>
                        {user.isActive ? 'Activo' : 'Inactivo'}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <RowActions actions={getRowActions(user)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            total={data.pagination.total}
            pageSize={data.pagination.limit}
            itemLabel="usuarios"
            onPageChange={setPage}
            disabled={isFetching}
            className="mt-4"
          />
        </>
      )}

      <ConfirmDialog
        isOpen={!!deactivateTarget}
        title="Desactivar usuario"
        message={`¿Desactivar a "${deactivateTarget?.name}"? No podrá iniciar sesión hasta que lo actives de nuevo; su historial se conserva.`}
        confirmText="Desactivar"
        cancelText="Cancelar"
        isDangerous
        onConfirm={handleConfirmDeactivate}
        onCancel={() => setDeactivateTarget(null)}
        isLoading={isTogglingActive}
      />
    </div>
  )
}
