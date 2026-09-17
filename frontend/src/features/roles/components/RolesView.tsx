import { useState } from 'react'
import { Card } from '../../../shared/components/Card'
import { Button } from '../../../shared/components/Button'
import { Skeleton } from '../../../shared/components/Skeleton'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { ActionMenu } from '../../../shared/components/ActionMenu'
import { RoleFormModal } from './RoleFormModal'
import { RolePermissionsDrawer } from './RolePermissionsDrawer'
import { useRolesList, useDeleteRole } from '../hooks/useRoles'
import { hasPermission } from '../../auth/utils/permissions'
import { getErrorMessage } from '../../../shared/utils/errors'
import { sileo } from 'sileo'
import type { AuthUser } from '../../auth/types/auth.types'

interface RolesViewProps {
  currentUser: AuthUser | null
}

/**
 * "Roles" view — answers "what types of access exist?". Shows only the roles
 * themselves (name, how many users have it, how many permissions it grants)
 * with a single primary action per row ("Editar permisos"); editing the
 * actual permission set happens in the shared RolePermissionsDrawer.
 */
export function RolesView({ currentUser }: RolesViewProps) {
  const canCreateRoles = hasPermission(currentUser, 'users.create')
  const canUpdateRoles = hasPermission(currentUser, 'users.update')
  const canDeleteRoles = hasPermission(currentUser, 'users.delete')

  const { data: roles, isLoading, isError } = useRolesList()
  const { mutate: deleteRole, isPending: isDeleting } = useDeleteRole()

  const [showRoleModal, setShowRoleModal] = useState(false)
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [permissionsRoleId, setPermissionsRoleId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const handleConfirmDelete = () => {
    if (!deleteTarget) return
    deleteRole(deleteTarget.id, {
      onSuccess: () => {
        sileo.success({ title: 'Rol eliminado', description: `El rol "${deleteTarget.name}" fue eliminado exitosamente.` })
        setDeleteTarget(null)
      },
      onError: (error: unknown) => {
        sileo.error({ title: 'Error', description: getErrorMessage(error, 'Error al eliminar rol') })
        setDeleteTarget(null)
      },
    })
  }

  return (
    <div className="space-y-4">
      <Card variant="panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Roles
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Define los tipos de acceso disponibles en el sistema
            </p>
          </div>
          {canCreateRoles && (
            <Button
              variant="primary"
              onClick={() => {
                setEditingRoleId(null)
                setShowRoleModal(true)
              }}
            >
              + Nuevo rol
            </Button>
          )}
        </div>
      </Card>

      <Card variant="panel">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            No se pudieron cargar los roles. Intenta de nuevo más tarde.
          </p>
        ) : !roles || roles.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            No hay roles configurados.
          </p>
        ) : (
          <div>
            {roles.map((role, index) => (
              <div
                key={role.id}
                className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                style={index > 0 ? { borderTop: '1px solid var(--color-border)' } : undefined}
              >
                <div>
                  <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {role.name}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {role._count.users} {role._count.users === 1 ? 'usuario' : 'usuarios'} ·{' '}
                    {role.permissions.length} {role.permissions.length === 1 ? 'permiso' : 'permisos'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="link" onClick={() => setPermissionsRoleId(role.id)}>
                    Editar permisos
                  </Button>
                  <ActionMenu
                    ariaLabel={`Más acciones para el rol ${role.name}`}
                    items={[
                      ...(canUpdateRoles
                        ? [
                            {
                              label: 'Editar nombre',
                              onClick: () => {
                                setEditingRoleId(role.id)
                                setShowRoleModal(true)
                              },
                            },
                          ]
                        : []),
                      ...(canDeleteRoles
                        ? [
                            {
                              label: 'Eliminar',
                              onClick: () => setDeleteTarget({ id: role.id, name: role.name }),
                              disabled: role.isSystem || isDeleting,
                              danger: true,
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <RoleFormModal
        isOpen={showRoleModal}
        onClose={() => {
          setShowRoleModal(false)
          setEditingRoleId(null)
        }}
        editingRoleId={editingRoleId}
        onSuccess={() => {
          setShowRoleModal(false)
          setEditingRoleId(null)
        }}
      />

      <RolePermissionsDrawer
        roleId={permissionsRoleId}
        currentUser={currentUser}
        onClose={() => setPermissionsRoleId(null)}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Eliminar rol"
        message={`¿Estás seguro de que deseas eliminar el rol "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        isDangerous
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
