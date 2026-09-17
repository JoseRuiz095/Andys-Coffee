import { useEffect, useMemo, useState } from 'react'
import { Drawer } from '../../../shared/components/Drawer'
import { Card } from '../../../shared/components/Card'
import { Button } from '../../../shared/components/Button'
import { Skeleton } from '../../../shared/components/Skeleton'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { useRoleById, usePermissionsList, useAssignPermissions } from '../hooks/useRoles'
import { toPermissionIds } from '../api/role.api'
import {
  groupPermissionsByModule,
  getPermissionLabel,
  getModuleLabel,
  getModuleFromPermissionName,
} from '../utils/permissionGroups'
import { hasPermission } from '../../auth/utils/permissions'
import { getErrorMessage } from '../../../shared/utils/errors'
import { sileo } from 'sileo'
import type { AuthUser } from '../../auth/types/auth.types'

interface RolePermissionsDrawerProps {
  roleId: string | null
  currentUser: AuthUser | null
  onClose: () => void
}

/**
 * Shared permissions editor for a single role. Used both from the Roles view
 * ("Editar permisos") and from a user's detail drawer ("Ver permisos del
 * rol") — both flows edit the same RolePermission resource through the same
 * UI, so there is only one place that implements the pending-changes/confirm
 * pattern.
 */
export function RolePermissionsDrawer({ roleId, currentUser, onClose }: RolePermissionsDrawerProps) {
  const canUpdateRoles = hasPermission(currentUser, 'users.update')
  const isOpen = !!roleId

  const { data: role, isLoading: isLoadingRole } = useRoleById(roleId)
  const { data: permissions, isLoading: isLoadingPermissions } = usePermissionsList()
  const { mutate: assignPermissions, isPending: isSaving } = useAssignPermissions()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (!role) return
    const timer = setTimeout(() => {
      setSelectedIds(new Set(toPermissionIds(role.permissions)))
    }, 0)
    return () => clearTimeout(timer)
  }, [role])

  const currentPermissionIds = useMemo(
    () => (role ? toPermissionIds(role.permissions) : []),
    [role]
  )

  const authorizedModules = useMemo(
    () => new Set((currentUser?.permissions ?? []).map((p) => getModuleFromPermissionName(p))),
    [currentUser]
  )

  const visiblePermissions = useMemo(
    () => (permissions ?? []).filter((p) => authorizedModules.has(getModuleFromPermissionName(p.name))),
    [permissions, authorizedModules]
  )

  const groups = useMemo(() => groupPermissionsByModule(visiblePermissions), [visiblePermissions])

  const isDirty = useMemo(() => {
    if (selectedIds.size !== currentPermissionIds.length) return true
    return currentPermissionIds.some((id) => !selectedIds.has(id))
  }, [selectedIds, currentPermissionIds])

  const pendingChanges = useMemo(() => {
    const currentSet = new Set(currentPermissionIds)
    const all = permissions ?? []
    return {
      added: all.filter((p) => selectedIds.has(p.id) && !currentSet.has(p.id)),
      removed: all.filter((p) => !selectedIds.has(p.id) && currentSet.has(p.id)),
    }
  }, [permissions, selectedIds, currentPermissionIds])

  const handleToggle = (permissionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(permissionId)) next.delete(permissionId)
      else next.add(permissionId)
      return next
    })
  }

  const handleDiscard = () => {
    setSelectedIds(new Set(currentPermissionIds))
  }

  const handleConfirmSave = () => {
    if (!role) return
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
          sileo.error({ title: 'Error', description: getErrorMessage(error, 'Error al actualizar permisos') })
          setShowConfirm(false)
        },
      }
    )
  }

  const isLoading = isLoadingRole || isLoadingPermissions
  const hasPendingList = pendingChanges.added.length > 0 || pendingChanges.removed.length > 0

  return (
    <>
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
              {role ? `Permisos del rol ${role.name}` : 'Permisos del rol'}
            </h2>
            {role && (
              <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {role._count.users} {role._count.users === 1 ? 'usuario tiene' : 'usuarios tienen'} este rol
              </p>
            )}
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : groups.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                No hay permisos disponibles.
              </p>
            ) : (
              groups.map((group) => (
                <Card key={group.module} variant="inset">
                  <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {group.label}
                  </h3>
                  <div className="space-y-2">
                    {group.permissions.map((permission) => (
                      <label
                        key={permission.id}
                        className="flex items-center gap-3 text-sm"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(permission.id)}
                          onChange={() => handleToggle(permission.id)}
                          disabled={!canUpdateRoles || isSaving}
                          className="h-4 w-4 accent-[var(--color-primary)] disabled:opacity-50"
                        />
                        {getPermissionLabel(permission)}
                      </label>
                    ))}
                  </div>
                </Card>
              ))
            )}

            {isDirty && hasPendingList && (
              <Card variant="inset">
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
              </Card>
            )}
          </div>

          {isDirty && (
            <div className="flex justify-end gap-3 border-t p-6" style={{ borderColor: 'var(--color-border)' }}>
              <Button variant="ghost" onClick={handleDiscard} disabled={isSaving}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={() => setShowConfirm(true)} disabled={!canUpdateRoles || isSaving}>
                {isSaving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>
          )}
        </div>
      </Drawer>

      {role && (
        <ConfirmDialog
          isOpen={showConfirm}
          title={`Modificar permisos del rol ${role.name}`}
          message={`Este cambio afectará a todos los usuarios que tengan este rol. ${role._count.users} ${role._count.users === 1 ? 'usuario será afectado' : 'usuarios serán afectados'}.`}
          confirmText="Guardar cambios"
          cancelText="Cancelar"
          onConfirm={handleConfirmSave}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  )
}
