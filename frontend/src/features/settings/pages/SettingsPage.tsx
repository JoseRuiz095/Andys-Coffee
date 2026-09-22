import React from 'react'
import { APP_ROUTES } from '../../../shared/constants/routes'
import { authStore } from '../../auth/store/auth.store'
import { hasPermission } from '../../auth/utils/permissions'
import { logout } from '../../auth/services/auth.service'
import { useTheme } from '../../../shared/assets/theme'
import { Card } from '../../../shared/components/Card'
import { Button } from '../../../shared/components/Button'
import { UsersView } from '../../users/components/UsersView'
import { RolesView } from '../../roles/components/RolesView'
import { ProfileForm } from '../components/ProfileForm'
import { ChangePasswordForm } from '../components/ChangePasswordForm'
import { SystemPreferencesForm } from '../../preferences'
import { DistributionSettingsForm, FixedExpenseSettingsForm } from '../../income-statement'
import { CashSessionHistory } from '../../dashboard/components/CashSessionHistory'
import type { AuthUser } from '../../auth/types/auth.types'
import brandLogo from '../../../shared/assets/logo/LetraAndysVector.svg'

type SettingsTab = 'profile' | 'preferences' | 'system-preferences' | 'users' | 'roles' | 'cash-history' | 'session'

function navigateTo(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function SettingsPage() {
  const [currentUser, setCurrentUser] = React.useState<AuthUser | null>(authStore.getState().user)
  const [activeTab, setActiveTab] = React.useState<SettingsTab>('profile')
  const { mode, setTheme } = useTheme()
  const isDark = mode === 'dark'

  React.useEffect(() => {
    const syncUser = () => setCurrentUser(authStore.getState().user)
    window.addEventListener('auth:changed', syncUser)
    return () => window.removeEventListener('auth:changed', syncUser)
  }, [])

  // Logging out never touches the cash drawer: the cut must be done with the real counted
  // cash from "Cierre de caja" (closing it here with the expected amount hid shortages).
  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      // The local session is cleared even if the API is unavailable.
    }
    authStore.clearSession()
    navigateTo(APP_ROUTES.login)
  }

  // Granular permission checks
  const canManageUsers = hasPermission(currentUser, 'users.read')
  const canReadCashHistory = hasPermission(currentUser, 'cash.read')
  const canCorrectCash = hasPermission(currentUser, 'cash.correct')
  const showAdminSection = canManageUsers || canReadCashHistory

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
              {showAdminSection && (
                <>
                  <div className="my-2 border-t" style={{ borderColor: 'var(--color-border)' }} />
                  <p className="px-3 py-2 text-xs font-semibold uppercase" style={{ color: 'var(--color-primary)' }}>Administración</p>
                </>
              )}
              {canManageUsers && (
                <>
                  <NavTab
                    label="Usuarios"
                    isActive={activeTab === 'users'}
                    onClick={() => setActiveTab('users')}
                  />
                  <NavTab
                    label="Roles"
                    isActive={activeTab === 'roles'}
                    onClick={() => setActiveTab('roles')}
                  />
                </>
              )}
              {canReadCashHistory && (
                <NavTab
                  label="Cortes de caja"
                  isActive={activeTab === 'cash-history'}
                  onClick={() => setActiveTab('cash-history')}
                />
              )}
              <div className="my-2 border-t" style={{ borderColor: 'var(--color-border)' }} />
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
              <div className="space-y-6">
                <Card variant="panel">
                  <SystemPreferencesForm />
                </Card>
                <Card variant="panel">
                  <DistributionSettingsForm />
                </Card>
                <Card variant="panel">
                  <FixedExpenseSettingsForm />
                </Card>
              </div>
            )}

            {/* Usuarios */}
            {activeTab === 'users' && canManageUsers && <UsersView currentUser={currentUser} />}

            {/* Roles */}
            {activeTab === 'roles' && canManageUsers && <RolesView currentUser={currentUser} />}

            {/* Cortes de caja */}
            {activeTab === 'cash-history' && canReadCashHistory && (
              <Card variant="panel">
                <CashSessionHistory canCorrect={canCorrectCash} />
              </Card>
            )}


            {/* Sesión */}
            {activeTab === 'session' && (
              <div className="space-y-4">
                <ContentHeader
                  title="Sesión"
                  description="Cierra tu sesión actual"
                />
                <Card variant="panel">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Cerrar sesión</h3>
                      <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {currentUser?.email || 'Sin correo registrado'} · {currentUser?.roleName || 'Usuario'}
                      </p>
                    </div>
                    <Button variant="primary" onClick={handleLogout}>
                      Cerrar sesión
                    </Button>
                  </div>
                </Card>
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
    <Card variant="panel">
      <h2 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
      <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{description}</p>
    </Card>
  )
}

function PreferencesPanel({ isDark, onThemeChange }: { isDark: boolean; onThemeChange: (mode: 'light' | 'dark') => void }) {
  const options: Array<{ value: 'light' | 'dark'; label: string }> = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ]

  return (
    <Card variant="panel">
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
    </Card>
  )
}
