import { useState } from 'react'
import { Button } from '../../../shared/components/Button'
import { PageHeader } from '../../../shared/components/PageHeader'
import { UserTable, type UserRowIntent } from './UserTable'
import { UserDetailDrawer } from './UserDetailDrawer'
import { UserFormModal } from './UserFormModal'
import { RolePermissionsDrawer } from '../../roles/components/RolePermissionsDrawer'
import { useRolesList } from '../../roles/hooks/useRoles'
import { useUserById } from '../hooks/useUsers'
import { hasPermission } from '../../auth/utils/permissions'
import type { AuthUser } from '../../auth/types/auth.types'

interface UsersViewProps {
  currentUser: AuthUser | null
}

/**
 * "Usuarios" view — answers "who has access to the system?". Owns only what
 * that question needs: filters + table + the selected user's detail drawer.
 * Role/permission editing is delegated to the roles feature so both flows
 * (from here, and from the Roles view) share one implementation.
 */
export function UsersView({ currentUser }: UsersViewProps) {
  const canCreateUsers = hasPermission(currentUser, 'users.create')
  const { data: roles } = useRolesList()

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [detailIntent, setDetailIntent] = useState<UserRowIntent>('view')
  // 'new' = creating; a user id = editing that user.
  const [form, setForm] = useState<'new' | string | null>(null)
  const [rolePermissionsRoleId, setRolePermissionsRoleId] = useState<string | null>(null)

  const editingUserId = form && form !== 'new' ? form : null
  const { data: editingUser } = useUserById(editingUserId)
  // The edit form opens once its user is loaded (it is usually cached by the detail drawer).
  const showForm = form === 'new' || (editingUserId !== null && editingUser?.id === editingUserId)

  return (
    <div>
      <PageHeader
        title="Usuarios"
        description="Quién tiene acceso al sistema y con qué rol."
        actions={
          canCreateUsers && (
            <Button variant="primary" onClick={() => setForm('new')}>
              + Nuevo usuario
            </Button>
          )
        }
      />

      <UserTable
        currentUser={currentUser}
        onSelectUser={(userId, intent) => {
          setSelectedUserId(userId)
          setDetailIntent(intent)
        }}
      />

      <UserDetailDrawer
        userId={selectedUserId}
        currentUser={currentUser}
        autoOpenRoleChange={detailIntent === 'changeRole'}
        onClose={() => setSelectedUserId(null)}
        onEditUser={(userId) => setForm(userId)}
        onViewRolePermissions={(roleId) => setRolePermissionsRoleId(roleId)}
      />

      <RolePermissionsDrawer
        roleId={rolePermissionsRoleId}
        currentUser={currentUser}
        onClose={() => setRolePermissionsRoleId(null)}
      />

      {/* Mounted per opening and keyed by the user, so the fields always start from them (or empty). */}
      {showForm && (
        <UserFormModal
          key={form ?? 'closed'}
          editingUser={form === 'new' ? null : editingUser}
          roles={roles ?? []}
          currentUser={currentUser}
          onClose={() => setForm(null)}
          onSuccess={() => setForm(null)}
        />
      )}
    </div>
  )
}
