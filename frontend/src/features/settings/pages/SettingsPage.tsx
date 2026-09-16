import React from 'react'
import { APP_ROUTES } from '../../../shared/constants/routes'
import { authStore } from '../../auth/store/auth.store'
import { hasPermission } from '../../auth/utils/permissions'
import { logout } from '../../auth/services/auth.service'
import { closeCashSession, getActiveCashSession } from '../../dashboard/services/cash.service'
import { SettingsIcon } from '../../../components/ui/settings'
import { UserTable } from '../../users/components/UserTable'
import { UserFormModal } from '../../users/components/UserFormModal'
import { RolePermissionMatrix } from '../../roles/components/RolePermissionMatrix'
import { RoleFormModal } from '../../roles/components/RoleFormModal'
import { ProfileForm } from '../components/ProfileForm'
import { ChangePasswordForm } from '../components/ChangePasswordForm'
import { useRolesList } from '../../roles/hooks/useRoles'
import type { AuthUser } from '../../auth/types/auth.types'
import brandLogo from '../../../shared/assets/logo/LetraAndysVector.svg'

type AdminPanel = 'users' | 'roles'

function navigateTo(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function SettingsPage() {
  const [currentUser, setCurrentUser] = React.useState<AuthUser | null>(authStore.getState().user)
  const [activePanel, setActivePanel] = React.useState<AdminPanel>('users')
  const [editingUserId, setEditingUserId] = React.useState<string | null>(null)
  const [showUserModal, setShowUserModal] = React.useState(false)
  const [editingRoleId, setEditingRoleId] = React.useState<string | null>(null)
  const [showRoleModal, setShowRoleModal] = React.useState(false)

  const { data: roles } = useRolesList()

  React.useEffect(() => {
    const syncUser = () => setCurrentUser(authStore.getState().user)
    window.addEventListener('auth:changed', syncUser)
    return () => window.removeEventListener('auth:changed', syncUser)
  }, [])

  const handleLogout = async () => {
    try {
      const session = await getActiveCashSession()
      if (session) {
        await closeCashSession({
          closingAmount: Number(session.expectedAmount),
          reason: 'Cierre al cerrar sesión',
          comment: 'Cierre automático al cerrar sesión.',
        })
      }
    } catch {
      // Logout must still complete if the session was already closed or unavailable.
    } finally {
      try {
        await logout()
      } catch {
        // The local session is cleared even if the API is unavailable.
      }
      authStore.clearSession()
      navigateTo(APP_ROUTES.login)
    }
  }

  const canManageUsers = hasPermission(currentUser, 'users.read')

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#FCF8EF_0%,_#F7F2E8_100%)]">
      <header className="border-b border-[#E7E3DC] bg-[#FDFBF7]/95 px-4 py-4 shadow-[0_8px_30px_rgba(45,33,29,0.05)] backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-15 w-15 items-center justify-center rounded-2xl border border-[#E7E3DC] bg-[#F3E8D6] p-2 shadow-sm">
              <img src={brandLogo} alt="Andys Coffee" className="h-8 w-auto object-contain" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#2C211D]">Configuración</p>
              <p className="text-xs text-[#6B7280]">{currentUser?.roleName || 'Usuario'}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigateTo(APP_ROUTES.dashboard)}
            className="rounded-full border border-[#E7E3DC] bg-white px-4 py-2 text-sm font-medium text-[#4B5563] shadow-sm transition hover:border-[#5A804F]/40 hover:bg-[#F2EFE8] hover:text-[#5A804F] focus:outline-none focus:ring-2 focus:ring-[#5A804F]/25"
          >
            Volver al dashboard
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 sm:p-6">
        <section className="mb-6 rounded-[1.75rem] border border-[#E7E3DC] bg-[#FDFBF7] p-5 shadow-[0_20px_50px_rgba(45,33,29,0.06)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#5A804F]">Panel del proyecto</p>
              <h1 className="mt-2 text-2xl font-semibold text-[#2C211D]">Configuración y accesos</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6B7280]">
                {canManageUsers
                  ? 'Gestiona usuarios, roles y permisos del sistema.'
                  : 'Actualiza tu perfil y contraseña.'}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#E7E3DC] bg-white text-[#5A804F] shadow-sm">
              <SettingsIcon size={24} aria-hidden="true" />
            </div>
          </div>
        </section>

        {/* Admin Panel */}
        {canManageUsers && (
          <section className="mb-6 rounded-2xl border border-[#E7E3DC] bg-white p-5 shadow-[0_14px_34px_rgba(45,33,29,0.06)]">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5A804F]">Administración</p>
                <h2 className="mt-2 text-lg font-semibold text-[#2C211D]">Gestión del sistema</h2>
              </div>
              <div className="flex rounded-full border border-[#E7E3DC] bg-[#FDFBF7] p-1">
                <button
                  type="button"
                  onClick={() => setActivePanel('users')}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    activePanel === 'users'
                      ? 'bg-[#5A804F] text-white shadow-sm'
                      : 'text-[#4B5563] hover:bg-[#F2EFE8]'
                  }`}
                >
                  Gestión de usuarios
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel('roles')}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    activePanel === 'roles'
                      ? 'bg-[#5A804F] text-white shadow-sm'
                      : 'text-[#4B5563] hover:bg-[#F2EFE8]'
                  }`}
                >
                  Roles y permisos
                </button>
              </div>
            </div>

            {activePanel === 'users' ? (
              <div>
                <UserTable
                  currentUser={currentUser}
                  onEditUser={(userId) => {
                    setEditingUserId(userId)
                    setShowUserModal(true)
                  }}
                  onCreateUser={() => {
                    setEditingUserId(null)
                    setShowUserModal(true)
                  }}
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
            ) : (
              <div>
                <RolePermissionMatrix />
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRoleId(null)
                      setShowRoleModal(true)
                    }}
                    className="rounded-lg bg-[#5A804F] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4a6a3f]"
                  >
                    Crear Rol
                  </button>
                </div>
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
              </div>
            )}
          </section>
        )}

        {/* Profile & Password */}
        <section className="mb-6 space-y-4">
          <ProfileForm currentUser={currentUser} />
          <ChangePasswordForm />
        </section>

        {/* Logout Section */}
        <section className="rounded-2xl border border-[#E7E3DC] bg-white p-5 shadow-[0_14px_34px_rgba(45,33,29,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5A804F]">Sesión</p>
          <div className="mt-3 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[#2C211D]">Cerrar sesión</h2>
              <p className="mt-1 text-sm text-[#6B7280]">
                {currentUser?.email || 'Sin correo registrado'} · {currentUser?.roleName || 'Usuario'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl bg-[#2C211D] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3A2A24] focus:outline-none focus:ring-2 focus:ring-[#2C211D]/25"
            >
              Cerrar sesión
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}
