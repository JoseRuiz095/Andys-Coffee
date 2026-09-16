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
import { SystemPreferencesForm } from '../../preferences'
import { useRolesList } from '../../roles/hooks/useRoles'
import type { AuthUser } from '../../auth/types/auth.types'
import brandLogo from '../../../shared/assets/logo/LetraAndysVector.svg'

type SettingsTab = 'profile' | 'preferences' | 'system-preferences' | 'users' | 'roles' | 'session'

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
  const { mode, setTheme } = useTheme()
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
    <div
      className="min-h-screen"
      style={{
        background: 'radial-gradient(circle at top, var(--color-surface) 0%, var(--color-background) 100%)',
      }}
    >
      {/* Header */}
      <header
        className="border-b px-4 py-4 shadow-[0_8px_30px_rgba(45,33,29,0.05)] backdrop-blur sm:px-6"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'color-mix(in srgb, var(--color-surface) 95%, transparent)',
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-15 w-15 items-center justify-center rounded-2xl border p-2 shadow-sm"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface)',
              }}
            >
              <img src={brandLogo} alt="Andys Coffee" className="h-8 w-auto object-contain" />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Configuración</p>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{currentUser?.roleName || 'Usuario'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigateTo(APP_ROUTES.dashboard)}
            className="rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
            }}
          >
            Volver al dashboard
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-6 p-4 sm:p-6 lg:grid-cols-4">
          {/* Sidebar Navigation */}
          <nav className="lg:col-span-1">
            <div
              className="space-y-1 rounded-2xl border p-3 shadow-[0_14px_34px_rgba(45,33,29,0.06)]"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface)',
              }}
            >
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
                <NavTab
                  label="Preferencias del Sistema"
                  isActive={activeTab === 'system-preferences'}
                  onClick={() => setActiveTab('system-preferences')}
                />
              )}
              {canManageUsers && (
                <>
                  <div className="my-2 border-t" style={{ borderColor: 'var(--color-border)' }} />
                  <p className="px-3 py-2 text-xs font-semibold uppercase" style={{ color: 'var(--color-primary)' }}>Administración</p>
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
                  title="Preferencias"
                  description="Personaliza tu experiencia de uso"
                />
                <PreferencesPanel isDark={isDark} onThemeChange={(mode) => setTheme(mode)} />
              </div>
            )}

            {/* Preferencias del Sistema */}
            {activeTab === 'system-preferences' && canManageUsers && (
              <div
                className="rounded-2xl border p-5 shadow-[0_14px_34px_rgba(45,33,29,0.06)]"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
              >
                <SystemPreferencesForm />
              </div>
            )}

            {/* Usuarios */}
            {activeTab === 'users' && canManageUsers && (
              <div className="space-y-4">
                <ContentHeader
                  title="Gestión de Usuarios"
                  description="Crea, edita y gestiona usuarios del sistema"
                />
                <div
                  className="rounded-2xl border p-5 shadow-[0_14px_34px_rgba(45,33,29,0.06)]"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                >
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
                <div
                  className="rounded-2xl border p-5 shadow-[0_14px_34px_rgba(45,33,29,0.06)]"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                >
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
                <div
                  className="rounded-2xl border p-5 shadow-[0_14px_34px_rgba(45,33,29,0.06)]"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Cerrar sesión</h3>
                      <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {currentUser?.email || 'Sin correo registrado'} · {currentUser?.roleName || 'Usuario'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition"
                      style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-button-text)' }}
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
      className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition"
      style={{
        backgroundColor: isActive ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'transparent',
        color: isActive ? 'var(--color-primary)' : 'var(--color-text-primary)',
      }}
    >
      {label}
    </button>
  )
}

function ContentHeader({ title, description }: { title: string; description: string }) {
  return (
    <div
      className="rounded-2xl border p-5 shadow-[0_14px_34px_rgba(45,33,29,0.06)]"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <h2 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
      <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{description}</p>
    </div>
  )
}

function PreferencesPanel({ isDark, onThemeChange }: { isDark: boolean; onThemeChange: (mode: 'light' | 'dark') => void }) {
  const options: Array<{ value: 'light' | 'dark'; label: string }> = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ]

  return (
    <div
      className="rounded-2xl border p-5 shadow-[0_14px_34px_rgba(45,33,29,0.06)]"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Tema</h3>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {isDark ? 'Modo oscuro activado' : 'Modo claro activado'}
            </p>
          </div>
        </div>

        <div
          className="grid grid-cols-2 gap-2 rounded-xl border p-1"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
        >
          {options.map((option) => {
            const selected = isDark === (option.value === 'dark')

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onThemeChange(option.value)}
                className="rounded-lg px-4 py-3 text-sm font-semibold transition"
                style={{
                  backgroundColor: selected ? 'var(--color-primary)' : 'transparent',
                  color: selected ? 'var(--color-button-text)' : 'var(--color-text-primary)',
                  boxShadow: selected ? '0 4px 10px rgba(90, 128, 79, 0.2)' : 'none',
                }}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Personaliza la apariencia de la interfaz. Los cambios se aplican inmediatamente.
        </p>
      </div>
    </div>
  )
}
