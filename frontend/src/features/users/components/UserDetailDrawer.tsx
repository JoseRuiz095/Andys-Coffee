import { useState } from 'react'
import { sileo } from 'sileo'
import { Drawer } from '../../../shared/components/Drawer'
import { Button } from '../../../shared/components/Button'
import { Select } from '../../../shared/components/Select'
import { StatusBadge } from '../../../shared/components/StatusBadge'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { Skeleton } from '../../../shared/components/Skeleton'
import { QueryErrorState } from '../../../shared/components/QueryErrorState'
import { useUserById, useUpdateUser, useSetUserActive, useDeleteUser } from '../hooks/useUsers'
import { useRolesList } from '../../roles/hooks/useRoles'
import { isRoleAssignable } from '../../roles/utils/permissionRules'
import { hasPermission } from '../../auth/utils/permissions'
import { getErrorMessage } from '../../../shared/utils/errors'
import { formatDate } from '../../../shared/utils/dateUtils'
import type { UserData } from '../api/user.api'
import type { AuthUser } from '../../auth/types/auth.types'

interface UserDetailDrawerProps {
  userId: string | null
  currentUser: AuthUser | null
  /** Opens the drawer with the role-change control already expanded (from the table's "Cambiar rol" action). */
  autoOpenRoleChange?: boolean
  onClose: () => void
  onEditUser: (userId: string) => void
  onViewRolePermissions: (roleId: string) => void
}

const sectionTitleStyle = { color: 'var(--color-text-secondary)' }

/**
 * Focused detail view for a single user. Deliberately does NOT show the
 * role's full permission list inline — permissions belong to the role
 * conceptually, so they are only reachable via "Ver permisos del rol",
 * which opens the shared RolePermissionsDrawer with the title
 * "Permisos del rol {NOMBRE}", never "Permisos de {usuario}".
 */
export function UserDetailDrawer({
  userId,
  currentUser,
  autoOpenRoleChange = false,
  onClose,
  onEditUser,
  onViewRolePermissions,
}: UserDetailDrawerProps) {
  const { data: user, isLoading, isError, error, refetch, isFetching } = useUserById(userId)

  return (
    <Drawer isOpen={!!userId} onClose={onClose} ariaLabelledBy="user-detail-title">
      <div className="flex h-full flex-col">
        <div className="border-b p-6" style={{ borderColor: 'var(--color-border)' }}>
          <button
            type="button"
            onClick={onClose}
            className="mb-3 text-sm font-medium hover:underline"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            ← Usuarios
          </button>
          {isLoading || !user ? (
            <h2 id="user-detail-title" className="sr-only">Detalle del usuario</h2>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <h2 id="user-detail-title" className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {user.name}
                </h2>
                <StatusBadge tone={user.isActive ? 'success' : 'neutral'}>{user.isActive ? 'Activo' : 'Inactivo'}</StatusBadge>
              </div>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {user.email} · Creado el {formatDate(user.createdAt)}
              </p>
            </>
          )}
        </div>

        {isError ? (
          <div className="p-6">
            <QueryErrorState error={error} subject="el usuario" onRetry={() => void refetch()} isRetrying={isFetching} />
          </div>
        ) : isLoading || !user ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : (
          // Keyed by the user: the role selector starts from their current role every time.
          <UserDetailBody
            key={`${user.id}-${autoOpenRoleChange}`}
            user={user}
            currentUser={currentUser}
            autoOpenRoleChange={autoOpenRoleChange}
            onClose={onClose}
            onEditUser={onEditUser}
            onViewRolePermissions={onViewRolePermissions}
          />
        )}
      </div>
    </Drawer>
  )
}

function UserDetailBody({
  user,
  currentUser,
  autoOpenRoleChange,
  onClose,
  onEditUser,
  onViewRolePermissions,
}: {
  user: UserData
  currentUser: AuthUser | null
  autoOpenRoleChange: boolean
  onClose: () => void
  onEditUser: (userId: string) => void
  onViewRolePermissions: (roleId: string) => void
}) {
  const isSelf = currentUser?.id === user.id
  const canUpdateUsers = hasPermission(currentUser, 'users.update')
  const canDeleteUsers = hasPermission(currentUser, 'users.delete')
  const { data: roles } = useRolesList()
  const currentRole = roles?.find((r) => r.id === user.roleId)
  // A1: users whose role has permissions you lack can't be edited, (de)activated nor deleted.
  const coversRole = currentRole ? isRoleAssignable(currentUser, currentRole) : false
  // The backend rejects changing your own role, deactivating or deleting your own account.
  const canChangeRole = canUpdateUsers && !isSelf && coversRole
  const canManage = isSelf || coversRole

  const { mutate: updateUser, isPending: isUpdatingRole } = useUpdateUser()
  const { mutate: setActive, isPending: isTogglingActive } = useSetUserActive()
  const { mutate: deleteUser, isPending: isDeleting } = useDeleteUser()

  const [isChangingRole, setIsChangingRole] = useState(autoOpenRoleChange && canChangeRole)
  const [selectedRoleId, setSelectedRoleId] = useState(user.roleId)
  const [showRoleConfirm, setShowRoleConfirm] = useState(false)
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const newRole = roles?.find((r) => r.id === selectedRoleId)

  const handleConfirmRoleChange = () => {
    updateUser(
      { id: user.id, data: { roleId: selectedRoleId } },
      {
        onSuccess: () => {
          sileo.success({ title: 'Rol actualizado', description: `El rol de ${user.name} ahora es ${newRole?.name}.` })
          setShowRoleConfirm(false)
          setIsChangingRole(false)
        },
        onError: (error: unknown) => {
          sileo.error({ title: 'No se pudo cambiar el rol', description: getErrorMessage(error, 'Inténtalo de nuevo.') })
          setShowRoleConfirm(false)
        },
      }
    )
  }

  const handleSetActive = (isActive: boolean) => {
    setActive(
      { id: user.id, isActive },
      {
        onSuccess: () => {
          setShowDeactivateConfirm(false)
          sileo.success({
            title: isActive ? 'Usuario activado' : 'Usuario desactivado',
            description: isActive ? `${user.name} puede volver a iniciar sesión.` : `${user.name} ya no puede iniciar sesión.`,
          })
        },
        onError: (error: unknown) =>
          sileo.error({
            title: isActive ? 'No se pudo activar el usuario' : 'No se pudo desactivar el usuario',
            description: getErrorMessage(error, 'Inténtalo de nuevo.'),
          }),
      }
    )
  }

  const handleConfirmDelete = () => {
    deleteUser(user.id, {
      onSuccess: () => {
        setShowDeleteConfirm(false)
        sileo.success({ title: 'Usuario eliminado', description: `${user.name} fue eliminado.` })
        onClose()
      },
      onError: (error: unknown) => {
        sileo.error({ title: 'No se pudo eliminar el usuario', description: getErrorMessage(error, 'Inténtalo de nuevo.') })
        setShowDeleteConfirm(false)
      },
    })
  }

  return (
    <>
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <section aria-labelledby="user-role-title">
          <h3 id="user-role-title" className="mb-2 text-xs font-semibold uppercase tracking-wide" style={sectionTitleStyle}>
            Rol
          </h3>
          {!isChangingRole ? (
            <>
              <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {currentRole?.name ?? user.role.name}
              </p>
              {currentRole && (
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {currentRole._count.users} {currentRole._count.users === 1 ? 'usuario tiene' : 'usuarios tienen'} este rol
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-4">
                <Button variant="link" onClick={() => onViewRolePermissions(user.roleId)}>
                  Ver permisos del rol
                </Button>
                {canChangeRole && (
                  <Button variant="link" onClick={() => setIsChangingRole(true)}>
                    Cambiar rol
                  </Button>
                )}
              </div>
              {isSelf && canUpdateUsers && (
                <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  No puedes cambiar tu propio rol; pídeselo a otro administrador.
                </p>
              )}
              {!canManage && canUpdateUsers && currentRole && (
                <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Su rol tiene permisos que tú no tienes: solo puede modificarlo alguien con esos permisos.
                </p>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <label htmlFor="user-detail-role" className="block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                Nuevo rol
              </label>
              <Select
                id="user-detail-role"
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                disabled={isUpdatingRole}
              >
                {roles?.map((role) => {
                  const assignable = isRoleAssignable(currentUser, role)
                  return (
                    <option key={role.id} value={role.id} disabled={!assignable && role.id !== user.roleId}>
                      {role.name}
                      {!assignable ? ' (incluye permisos que no tienes)' : ''}
                    </option>
                  )
                })}
              </Select>
              <div className="flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsChangingRole(false)
                    setSelectedRoleId(user.roleId)
                  }}
                  disabled={isUpdatingRole}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setShowRoleConfirm(true)}
                  disabled={selectedRoleId === user.roleId || isUpdatingRole}
                >
                  {isUpdatingRole ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </div>
            </div>
          )}
        </section>

        {canUpdateUsers && canManage && (
          <section aria-labelledby="user-actions-title" className="border-t pt-5" style={{ borderColor: 'var(--color-border)' }}>
            <h3 id="user-actions-title" className="mb-2 text-xs font-semibold uppercase tracking-wide" style={sectionTitleStyle}>
              Acciones
            </h3>
            <div className="flex flex-wrap gap-4">
              <Button variant="link" onClick={() => onEditUser(user.id)}>
                Editar nombre y correo
              </Button>
              {!isSelf && (
                <Button
                  variant="link"
                  onClick={() => (user.isActive ? setShowDeactivateConfirm(true) : handleSetActive(true))}
                  disabled={isTogglingActive}
                >
                  {isTogglingActive ? 'Cambiando...' : user.isActive ? 'Desactivar' : 'Activar'}
                </Button>
              )}
            </div>
          </section>
        )}

        {canDeleteUsers && !isSelf && coversRole && (
          <section
            aria-labelledby="user-danger-title"
            className="rounded-xl border p-4"
            style={{ borderColor: 'color-mix(in srgb, var(--color-danger) 35%, var(--color-border))' }}
          >
            <h3 id="user-danger-title" className="text-sm font-semibold" style={{ color: 'var(--color-danger)' }}>
              Zona de riesgo
            </h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Solo se pueden eliminar usuarios sin actividad registrada. Si tiene ventas, cortes o movimientos, desactívalo en su lugar.
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="mt-3 min-h-10 rounded-lg border px-4 text-sm font-semibold transition hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
              style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
            >
              Eliminar usuario
            </button>
          </section>
        )}
      </div>

      <ConfirmDialog
        isOpen={showRoleConfirm}
        title="Confirmar cambio de rol"
        message={`¿Cambiar el rol de ${user.name} de ${currentRole?.name ?? user.role.name} a ${newRole?.name}? Sus permisos cambiarán en su siguiente acción.`}
        confirmText="Cambiar rol"
        cancelText="Cancelar"
        onConfirm={handleConfirmRoleChange}
        onCancel={() => setShowRoleConfirm(false)}
        isLoading={isUpdatingRole}
      />
      <ConfirmDialog
        isOpen={showDeactivateConfirm}
        title="Desactivar usuario"
        message={`¿Desactivar a "${user.name}"? No podrá iniciar sesión hasta que lo actives de nuevo; su historial se conserva.`}
        confirmText="Desactivar"
        cancelText="Cancelar"
        isDangerous
        onConfirm={() => handleSetActive(false)}
        onCancel={() => setShowDeactivateConfirm(false)}
        isLoading={isTogglingActive}
      />
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Eliminar usuario"
        message={`¿Eliminar a "${user.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        isDangerous
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        isLoading={isDeleting}
      />
    </>
  )
}
