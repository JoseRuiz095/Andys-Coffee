import { useState } from 'react'
import { Card } from '../../../shared/components/Card'
import { Button } from '../../../shared/components/Button'
import { UserTable, type UserRowIntent } from './UserTable'
import { UserDetailDrawer } from './UserDetailDrawer'
import { UserFormModal } from './UserFormModal'
import { RolePermissionsDrawer } from '../../roles/components/RolePermissionsDrawer'
import { useRolesList } from '../../roles/hooks/useRoles'
import { hasPermission } from '../../auth/utils/permissions'
import type { AuthUser } from '../../auth/types/auth.types'

interface UsersViewProps {
  currentUser: AuthUser | null
}

/**
 * "Usuarios" view — answers "who has access to the system?". Owns only what
 * that question needs: search + table + the selected user's detail drawer.
 * Role/permission editing is delegated to the roles feature so both flows
 * (from here, and from the Roles view) share one implementation.
 */
export function UsersView({ currentUser }: UsersViewProps) {
  const canCreateUsers = hasPermission(currentUser, 'users.create')
  const { data: roles } = useRolesList()

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [detailIntent, setDetailIntent] = useState<UserRowIntent>('view')
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [rolePermissionsRoleId, setRolePermissionsRoleId] = useState<string | null>(null)

  const handleSelectUser = (userId: string, intent: UserRowIntent) => {
    setSelectedUserId(userId)
    setDetailIntent(intent)
  }

  return (
    <div className="space-y-4">
      <Card variant="panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Usuarios
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Gestiona los usuarios y su acceso al sistema
            </p>
          </div>
          {canCreateUsers && (
            <Button
              variant="primary"
              onClick={() => {
                setEditingUserId(null)
                setShowUserModal(true)
              }}
            >
              + Nuevo usuario
            </Button>
          )}
        </div>
      </Card>

      <Card variant="panel">
        <UserTable currentUser={currentUser} onSelectUser={handleSelectUser} />
      </Card>

      <UserDetailDrawer
        userId={selectedUserId}
        currentUser={currentUser}
        autoOpenRoleChange={detailIntent === 'changeRole'}
        onClose={() => setSelectedUserId(null)}
        onEditUser={(userId) => {
          setEditingUserId(userId)
          setShowUserModal(true)
        }}
        onViewRolePermissions={(roleId) => setRolePermissionsRoleId(roleId)}
      />

      <RolePermissionsDrawer
        roleId={rolePermissionsRoleId}
        currentUser={currentUser}
        onClose={() => setRolePermissionsRoleId(null)}
      />

      <UserFormModal
        isOpen={showUserModal}
        onClose={() => {
          setShowUserModal(false)
          setEditingUserId(null)
        }}
        editingUserId={editingUserId}
        roles={roles || []}
        onSuccess={() => {
          setShowUserModal(false)
          setEditingUserId(null)
        }}
      />
    </div>
  )
}
