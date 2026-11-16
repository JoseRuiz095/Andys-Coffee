import { useMemo, useState } from 'react'
import { Drawer } from '../../../shared/components/Drawer'
import { Button } from '../../../shared/components/Button'
import { Skeleton } from '../../../shared/components/Skeleton'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { StatusBadge } from '../../../shared/components/StatusBadge'
import { QueryErrorState } from '../../../shared/components/QueryErrorState'
import { useRoleById, usePermissionsList, useAssignPermissions } from '../hooks/useRoles'
import { toPermissionIds, type RoleData } from '../api/role.api'
import {
  groupPermissionsByModule,
  getPermissionLabel,
  getPermissionNote,
  getModuleLabel,
  getModuleFromPermissionName,
  isSensitivePermission,
} from '../utils/permissionGroups'
import { canGrantPermission, getRolePermissionsAccess } from '../utils/permissionRules'
import { getErrorMessage } from '../../../shared/utils/errors'
import { sileo } from 'sileo'
import type { AuthUser } from '../../auth/types/auth.types'

interface RolePermissionsDrawerProps {
  roleId: string | null
  currentUser: AuthUser | null
  onClose: () => void
}

const READ_ONLY_REASON: Record<'no-update' | 'system-role' | 'missing-permissions', string> = {
  'no-update': 'Solo puedes consultar los permisos: editarlos requiere el permiso "Editar usuarios".',
  'system-role':
    'Es un rol del sistema: cambiar sus permisos requiere "Gestionar permisos de roles del sistema".',
  'missing-permissions':
    'Este rol incluye permisos que tú no tienes, así que no puedes modificarlo. Pídeselo a un administrador.',
}

/**
 * Shared permissions editor for a single role. Used both from the Roles view
 * ("Permisos") and from a user's detail drawer ("Ver permisos del rol") — both
 * flows edit the same RolePermission resource through the same UI, so there is
 * only one place that implements the pending-changes/confirm pattern.
 *
 * Every module is listed (also the ones the actor has no access to) so the whole role can be
 * understood; what the backend would reject is shown read-only instead of failing on save.
 */
export function RolePermissionsDrawer({ roleId, currentUser, onClose }: RolePermissionsDrawerProps) {
  const isOpen = !!roleId
  const roleQuery = useRoleById(roleId)
  const permissionsQuery = usePermissionsList()

  return (
    <Drawer isOpen={isOpen} onClose={onClose} ariaLabelledBy="role-permissions-title">
      <div className="flex h-full flex-col">
        <div className="border-b p-6" style={{ borderColor: 'var(--color-border)' }}>
          <button
            type="button"
            onClick={onClose}
            className="mb-2 text-sm font-medium hover:underline"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            ← Volver
          </button>
          <h2 id="role-permissions-title" className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {roleQuery.data ? `Permisos del rol ${roleQuery.data.name}` : 'Permisos del rol'}
          </h2>
          {roleQuery.data && (
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {roleQuery.data._count.users} {roleQuery.data._count.users === 1 ? 'usuario tiene' : 'usuarios tienen'} este rol
            </p>
          )}
        </div>

        {roleQuery.isError || permissionsQuery.isError ? (
          <div className="p-6">
            <QueryErrorState
              error={roleQuery.error ?? permissionsQuery.error}
              subject="los permisos del rol"
              onRetry={() => {
                void roleQuery.refetch()
                void permissionsQuery.refetch()
              }}
              isRetrying={roleQuery.isFetching || permissionsQuery.isFetching}
            />
          </div>
        ) : !roleQuery.data || !permissionsQuery.data ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : (
          // Keyed by the loaded role: the checkboxes start from its saved permissions every time.
          <PermissionsEditor
            key={`${roleQuery.data.id}-${roleQuery.data.updatedAt}`}
            role={roleQuery.data}
            permissions={permissionsQuery.data}
            currentUser={currentUser}
          />
        )}
      </div>
    </Drawer>
  )
}

function PermissionsEditor({
  role,
  permissions,
  currentUser,
}: {
  role: RoleData
  permissions: { id: string; name: string; description?: string }[]
  currentUser: AuthUser | null
}) {
  const { mutate: assignPermissions, isPending: isSaving } = useAssignPermissions()
  const currentPermissionIds = useMemo(() => toPermissionIds(role.permissions), [role])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(currentPermissionIds))
  const [showConfirm, setShowConfirm] = useState(false)

  const access = getRolePermissionsAccess(currentUser, role)
  const groups = useMemo(() => groupPermissionsByModule(permissions), [permissions])

  const pendingChanges = useMemo(() => {
    const currentSet = new Set(currentPermissionIds)
    return {
      added: permissions.filter((p) => selectedIds.has(p.id) && !currentSet.has(p.id)),
      removed: permissions.filter((p) => !selectedIds.has(p.id) && currentSet.has(p.id)),
    }
  }, [permissions, selectedIds, currentPermissionIds])
  const isDirty = pendingChanges.added.length > 0 || pendingChanges.removed.length > 0

  const handleToggle = (permissionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(permissionId)) next.delete(permissionId)
      else next.add(permissionId)
      return next
    })
  }

  const handleConfirmSave = () => {
    assignPermissions(
      { id: role.id, permissionIds: Array.from(selectedIds) },
      {
        onSuccess: () => {
          sileo.success({
            title: 'Permisos actualizados',
            description: `Los permisos del rol ${role.name} fueron actualizados.`,
          })
          setShowConfirm(false)
        },
        onError: (error: unknown) => {
          sileo.error({ title: 'No se pudieron guardar los permisos', description: getErrorMessage(error, 'Inténtalo de nuevo.') })
          setShowConfirm(false)
        },
      }
    )
  }

  return (
    <>
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {!access.canEdit && (
          <p
            role="status"
            className="rounded-lg border px-4 py-3 text-sm"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'color-mix(in srgb, var(--color-info) 8%, var(--color-surface))',
              color: 'var(--color-text-primary)',
            }}
          >
            {READ_ONLY_REASON[access.reason]}
          </p>
        )}

        {groups.map((group) => {
          const granted = group.permissions.filter((p) => selectedIds.has(p.id)).length
          return (
            <fieldset key={group.module} className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
              <legend className="flex w-full items-center justify-between gap-3 px-1 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                <span>{group.label}</span>
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  {granted} de {group.permissions.length}
                </span>
              </legend>
              <div className="mt-2 space-y-1">
                {group.permissions.map((permission) => {
                  const grantable = canGrantPermission(currentUser, permission.name)
                  const note = getPermissionNote(permission)
                  const disabled = !access.canEdit || !grantable || isSaving
                  return (
                    <label
                      key={permission.id}
                      className="flex min-h-10 items-start gap-3 rounded-lg px-1 py-1.5 text-sm"
                      style={{ color: 'var(--color-text-primary)', cursor: disabled ? 'default' : 'pointer' }}
                      title={access.canEdit && !grantable ? 'No puedes otorgar permisos que tú no tienes.' : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(permission.id)}
                        onChange={() => handleToggle(permission.id)}
                        disabled={disabled}
                        className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-primary)] disabled:opacity-50"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          {getPermissionLabel(permission)}
                          {isSensitivePermission(permission) && <StatusBadge tone="warning">Sensible</StatusBadge>}
                        </span>
                        {note && (
                          <span className="mt-0.5 block text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                            {note}
                          </span>
                        )}
                        {access.canEdit && !grantable && (
                          <span className="mt-0.5 block text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                            No puedes otorgarlo porque tú no lo tienes.
                          </span>
                        )}
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )
        })}

        {isDirty && (
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
            <h3 className="mb-2 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Cambios pendientes
            </h3>
            <ul className="space-y-1 text-sm">
              {pendingChanges.added.map((p) => (
                <li key={p.id} style={{ color: 'var(--color-success)' }}>
                  + {getModuleLabel(getModuleFromPermissionName(p.name))} → {getPermissionLabel(p)}
                </li>
              ))}
              {pendingChanges.removed.map((p) => (
                <li key={p.id} style={{ color: 'var(--color-danger)' }}>
                  − {getModuleLabel(getModuleFromPermissionName(p.name))} → {getPermissionLabel(p)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {isDirty && access.canEdit && (
        <div className="flex justify-end gap-3 border-t p-6" style={{ borderColor: 'var(--color-border)' }}>
          <Button variant="ghost" onClick={() => setSelectedIds(new Set(currentPermissionIds))} disabled={isSaving}>
            Descartar
          </Button>
          <Button variant="primary" onClick={() => setShowConfirm(true)} disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      )}

      <ConfirmDialog
        isOpen={showConfirm}
        title={`Modificar permisos del rol ${role.name}`}
        message={`Este cambio afectará a todos los usuarios que tengan este rol. ${role._count.users} ${role._count.users === 1 ? 'usuario será afectado' : 'usuarios serán afectados'}.`}
        confirmText="Guardar cambios"
        cancelText="Cancelar"
        onConfirm={handleConfirmSave}
        onCancel={() => setShowConfirm(false)}
        isLoading={isSaving}
      />
    </>
  )
}
