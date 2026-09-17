import { useEffect, useState } from 'react'
import { Drawer } from '../../../shared/components/Drawer'
import { Card } from '../../../shared/components/Card'
import { Button } from '../../../shared/components/Button'
import { Select } from '../../../shared/components/Select'
import { StatusBadge } from '../../../shared/components/StatusBadge'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { Skeleton } from '../../../shared/components/Skeleton'
import { useUserById, useUpdateUser, useSetUserActive, useDeleteUser } from '../hooks/useUsers'
import { useRolesList } from '../../roles/hooks/useRoles'
import { hasPermission } from '../../auth/utils/permissions'
import { blockIfSelf } from '../utils/selfGuard'
import { getErrorMessage } from '../../../shared/utils/errors'
import { sileo } from 'sileo'
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
  const canUpdateUsers = hasPermission(currentUser, 'users.update')
  const canDeleteUsers = hasPermission(currentUser, 'users.delete')

  const isOpen = !!userId
  const { data: user, isLoading } = useUserById(userId)
  const { data: roles } = useRolesList()
  const { mutate: updateUser, isPending: isUpdatingRole } = useUpdateUser()
  const { mutate: setActive, isPending: isTogglingActive } = useSetUserActive()
  const { mutate: deleteUser, isPending: isDeleting } = useDeleteUser()

  const [isChangingRole, setIsChangingRole] = useState(false)
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [showRoleConfirm, setShowRoleConfirm] = useState(false)
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (user?.roleId) setSelectedRoleId(user.roleId)
      setIsChangingRole(!!autoOpenRoleChange)
    }, 0)
    return () => clearTimeout(timer)
  }, [user?.id, user?.roleId, autoOpenRoleChange])

  const currentRole = roles?.find((r) => r.id === user?.roleId)
  const newRole = roles?.find((r) => r.id === selectedRoleId)

  const handleConfirmRoleChange = () => {
    if (!user) return
    updateUser(
      { id: user.id, data: { roleId: selectedRoleId } },
      {
        onSuccess: () => {
          sileo.success({
            title: 'Rol actualizado',
            description: `El rol de ${user.name} fue actualizado a ${newRole?.name}.`,
          })
          setShowRoleConfirm(false)
          setIsChangingRole(false)
        },
        onError: (error: unknown) => {
          sileo.error({ title: 'Error', description: getErrorMessage(error, 'Error al actualizar rol') })
          setShowRoleConfirm(false)
        },
      }
    )
  }

  const handleDeactivate = () => {
    if (!user) return
    if (blockIfSelf(currentUser, user.id, 'desactivar')) return
    setShowDeactivateConfirm(true)
  }

  const handleConfirmDeactivate = () => {
    if (!user) return
    setActive(
      { id: user.id, isActive: false },
      {
        onError: (error: unknown) => {
          sileo.error({ title: 'Error', description: getErrorMessage(error, 'Error al desactivar usuario') })
        },
      }
    )
    setShowDeactivateConfirm(false)
  }

  const handleActivate = () => {
    if (!user) return
    setActive(
      { id: user.id, isActive: true },
      {
        onError: (error: unknown) => {
          sileo.error({ title: 'Error', description: getErrorMessage(error, 'Error al activar usuario') })
        },
      }
    )
  }

  const handleDelete = () => {
    if (!user) return
    if (blockIfSelf(currentUser, user.id, 'eliminar')) return
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = () => {
    if (!user) return
    deleteUser(user.id, {
      onSuccess: () => {
        setShowDeleteConfirm(false)
        onClose()
      },
      onError: (error: unknown) => {
        sileo.error({ title: 'Error', description: getErrorMessage(error, 'Error al eliminar usuario') })
        setShowDeleteConfirm(false)
      },
    })
  }

  return (
    <>
      <Drawer isOpen={isOpen} onClose={onClose} ariaLabelledBy="user-detail-title">
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
              <Skeleton className="h-16" />
            ) : (
              <>
                <h2 id="user-detail-title" className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {user.name}
                </h2>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{user.email}</p>
                <div className="mt-3">
                  <StatusBadge tone={user.isActive ? 'success' : 'danger'}>
                    {user.isActive ? 'Activo' : 'Inactivo'}
                  </StatusBadge>
                </div>
              </>
            )}
          </div>

          {!isLoading && user && (
            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              <Card variant="inset">
                <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Información básica
                </h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt style={{ color: 'var(--color-text-secondary)' }}>Correo</dt>
                    <dd style={{ color: 'var(--color-text-primary)' }}>{user.email}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt style={{ color: 'var(--color-text-secondary)' }}>Creado</dt>
                    <dd style={{ color: 'var(--color-text-primary)' }}>
                      {new Date(user.createdAt).toLocaleDateString('es-MX')}
                    </dd>
                  </div>
                </dl>
              </Card>

              <Card variant="inset">
                <h3 className="mb-1 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Rol
                </h3>

                {!isChangingRole ? (
                  <>
                    <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      {currentRole?.name ?? '—'}
                    </p>
                    {currentRole && (
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {currentRole._count.users} {currentRole._count.users === 1 ? 'usuario tiene' : 'usuarios tienen'} este rol
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-4">
                      {canUpdateUsers && (
                        <Button variant="link" onClick={() => setIsChangingRole(true)}>
                          Cambiar rol
                        </Button>
                      )}
                      {currentRole && (
                        <Button variant="link" onClick={() => onViewRolePermissions(currentRole.id)}>
                          Ver permisos del rol
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <Select
                      value={selectedRoleId}
                      onChange={(e) => setSelectedRoleId(e.target.value)}
                      disabled={isUpdatingRole}
                    >
                      {roles?.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
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
              </Card>

              <Card variant="inset">
                <div className="space-y-2">
                  {canUpdateUsers && (
                    <Button
                      variant="link"
                      onClick={() => onEditUser(user.id)}
                      className="w-full text-left"
                    >
                      Editar
                    </Button>
                  )}
                  {canUpdateUsers && (
                    <Button
                      variant="link"
                      onClick={user.isActive ? handleDeactivate : handleActivate}
                      disabled={isTogglingActive}
                      className="w-full text-left"
                    >
                      {user.isActive ? 'Desactivar' : 'Activar'}
                    </Button>
                  )}
                  {canDeleteUsers && (
                    <Button
                      variant="link"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="w-full text-left"
                      style={{ color: 'var(--color-danger)' }}
                    >
                      Eliminar
                    </Button>
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      </Drawer>

      {user && (
        <>
          <ConfirmDialog
            isOpen={showRoleConfirm}
            title="Confirmar cambio de rol"
            message={`¿Cambiar el rol de ${user.name} a ${newRole?.name}? Los permisos del usuario se actualizarán automáticamente.`}
            confirmText="Confirmar"
            cancelText="Cancelar"
            onConfirm={handleConfirmRoleChange}
            onCancel={() => setShowRoleConfirm(false)}
          />
          <ConfirmDialog
            isOpen={showDeactivateConfirm}
            title="Desactivar usuario"
            message={`¿Estás seguro de que deseas desactivar a "${user.name}"? Podrá reactivarse después.`}
            confirmText="Desactivar"
            cancelText="Cancelar"
            isDangerous
            onConfirm={handleConfirmDeactivate}
            onCancel={() => setShowDeactivateConfirm(false)}
          />
          <ConfirmDialog
            isOpen={showDeleteConfirm}
            title="Eliminar usuario"
            message={`¿Estás seguro de que deseas eliminar a "${user.name}"? Esta acción no se puede deshacer.`}
            confirmText="Eliminar"
            cancelText="Cancelar"
            isDangerous
            onConfirm={handleConfirmDelete}
            onCancel={() => setShowDeleteConfirm(false)}
          />
        </>
      )}
    </>
  )
}
