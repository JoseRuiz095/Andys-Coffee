import React from 'react'
import { APP_ROUTES } from '../../../shared/constants/routes'
import { authStore } from '../../auth/store/auth.store'
import { hasPermission } from '../../auth/utils/permissions'
import { logout } from '../../auth/services/auth.service'
import { closeCashSession, getActiveCashSession } from '../../dashboard/services/cash.service'
import { useTheme } from '../../../shared/assets/theme'
import { UserTable } from '../../users/components/UserTable'
import { UserFormModal } from '../../users/components/UserFormModal'
import { RolePermissionMatrix } from '../../roles/components/RolePermissionMatrix'
import { RoleFormModal } from '../../roles/components/RoleFormModal'
import { ProfileForm } from '../components/ProfileForm'
import { ChangePasswordForm } from '../components/ChangePasswordForm'
import { useRolesList } from '../../roles/hooks/useRoles'
import type { AuthUser } from '../../auth/types/auth.types'
import brandLogo from '../../../shared/assets/logo/LetraAndysVector.svg'

type SettingsTab = 'profile' | 'preferences' | 'users' | 'roles' | 'session'

function navigateTo(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function SettingsPage() {
  const [currentUser, setCurrentUser] = React.useState<AuthUser | null>(authStore.getState().user)
  const [activeTab, setActiveTab] = React.useState<SettingsTab>('profile')
  const [editingUserId, setEditingUserId] = React.useState<string | null>(null)
  const [showUserModal, setShowUserModal] = React.useState(false)
  const [editingRoleId, setEditingRoleId] = React.useState<string | null>(null)
  const [showRoleModal, setShowRoleModal] = React.useState(false)
  const { mode, toggleTheme } = useTheme()
  const { data: roles } = useRolesList()
  const isDark = mode === 'dark'

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

  // Granular permission checks
  const canViewUsers = hasPermission(currentUser, 'users.read')
  const canManageUsers = canViewUsers // Display admin panel if user can read
  const canCreateRoles = hasPermission(currentUser, 'users.create')

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#FCF8EF_0%,_#F7F2E8_100%)]">
      {/* Header */}
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
            className="rounded-full border border-[#E7E3DC] bg-white px-4 py-2 text-sm font-medium text-[#4B5563] shadow-sm transition hover:border-[#5A804F]/40 hover:bg-[#F2EFE8] hover:text-[#5A804F]"
          >
            Volver al dashboard
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-6 p-4 sm:p-6 lg:grid-cols-4">
          {/* Sidebar Navigation */}
          <nav className="lg:col-span-1">
            <div className="space-y-1 rounded-2xl border border-[#E7E3DC] bg-white p-3 shadow-[0_14px_34px_rgba(45,33,29,0.06)]">
              <NavTab
                label="Mi Perfil"
                isActive={activeTab === 'profile'}
                onClick={() => setActiveTab('profile')}
              />
              <NavTab
                label="Preferencias"
                isActive={activeTab === 'preferences'}
                onClick={() => setActiveTab('preferences')}
              />
              {canManageUsers && (
                <>
                  <div className="my-2 border-t border-[#E7E3DC]" />
                  <p className="px-3 py-2 text-xs font-semibold uppercase text-[#5A804F]">Administración</p>
                  <NavTab
                    label="Usuarios"
                    isActive={activeTab === 'users'}
                    onClick={() => setActiveTab('users')}
                  />
                  <NavTab
                    label="Roles y Permisos"
                    isActive={activeTab === 'roles'}
                    onClick={() => setActiveTab('roles')}
                  />
                </>
              )}
              <div className="my-2 border-t border-[#E7E3DC]" />
              <NavTab
                label="Sesión"
                isActive={activeTab === 'session'}
                onClick={() => setActiveTab('session')}
              />
            </div>
          </nav>

          {/* Content Area */}
          <div className="lg:col-span-3">
            {/* Mi Perfil */}
            {activeTab === 'profile' && (
              <div className="space-y-4">
                <ContentHeader
                  title="Mi Perfil"
                  description="Actualiza tu información personal y contraseña"
                />
                <ProfileForm currentUser={currentUser} />
                <ChangePasswordForm />
              </div>
            )}

            {/* Preferencias */}
            {activeTab === 'preferences' && (
              <div className="space-y-4">
                <ContentHeader
                  title="Preferencias del Sistema"
                  description="Personaliza tu experiencia de uso"
                />
                <PreferencesPanel isDark={isDark} onThemeToggle={toggleTheme} />
              </div>
            )}

            {/* Usuarios */}
            {activeTab === 'users' && canManageUsers && (
              <div className="space-y-4">
                <ContentHeader
                  title="Gestión de Usuarios"
                  description="Crea, edita y gestiona usuarios del sistema"
                />
                <div className="rounded-2xl border border-[#E7E3DC] bg-white p-5 shadow-[0_14px_34px_rgba(45,33,29,0.06)]">
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
              </div>
            )}

            {/* Roles y Permisos */}
            {activeTab === 'roles' && canManageUsers && (
              <div className="space-y-4">
                <ContentHeader
                  title="Roles y Permisos"
                  description="Define y gestiona los roles y sus permisos"
                />
                <div className="rounded-2xl border border-[#E7E3DC] bg-white p-5 shadow-[0_14px_34px_rgba(45,33,29,0.06)]">
                  <RolePermissionMatrix currentUser={currentUser} />
                  {canCreateRoles && (
                    <div className="mt-6 flex justify-end">
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
                  )}
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
              </div>
            )}

            {/* Sesión */}
            {activeTab === 'session' && (
              <div className="space-y-4">
                <ContentHeader
                  title="Sesión"
                  description="Cierra tu sesión actual"
                />
                <div className="rounded-2xl border border-[#E7E3DC] bg-white p-5 shadow-[0_14px_34px_rgba(45,33,29,0.06)]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-[#2C211D]">Cerrar sesión</h3>
                      <p className="mt-1 text-sm text-[#6B7280]">
                        {currentUser?.email || 'Sin correo registrado'} · {currentUser?.roleName || 'Usuario'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="rounded-xl bg-[#2C211D] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3A2A24]"
                    >
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

// Helper Components
function NavTab({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
        isActive
          ? 'bg-[#5A804F]/10 text-[#5A804F]'
          : 'text-[#4B5563] hover:bg-[#FDFBF7]'
      }`}
    >
      {label}
    </button>
  )
}

function ContentHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-[#E7E3DC] bg-[#FDFBF7] p-5 shadow-[0_14px_34px_rgba(45,33,29,0.06)]">
      <h2 className="text-2xl font-semibold text-[#2C211D]">{title}</h2>
      <p className="mt-2 text-sm text-[#6B7280]">{description}</p>
    </div>
  )
}

function PreferencesPanel({ isDark, onThemeToggle }: { isDark: boolean; onThemeToggle: () => void }) {
  return (
    <div className="rounded-2xl border border-[#E7E3DC] bg-white p-5 shadow-[0_14px_34px_rgba(45,33,29,0.06)]">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 border-b border-[#E7E3DC] pb-4">
          <div>
            <h3 className="font-semibold text-[#2C211D]">Tema</h3>
            <p className="text-sm text-[#6B7280]">
              {isDark ? 'Modo oscuro activado' : 'Modo claro activado'}
            </p>
          </div>
          <button
            onClick={onThemeToggle}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition ${
              isDark ? 'bg-[#5A804F]' : 'bg-[#E7E3DC]'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
                isDark ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <p className="text-xs text-[#6B7280]">
          Personaliza la apariencia de la interfaz. Los cambios se aplican inmediatamente.
        </p>
      </div>
    </div>
  )
}
