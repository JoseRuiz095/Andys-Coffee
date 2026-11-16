import { useEffect, type ReactNode } from 'react'
import { APP_ROUTES } from '../../../shared/constants/routes'
import { authStore } from '../../auth/store/auth.store'
import { hasPermission, SETTINGS_PERMISSION } from '../../auth/utils/permissions'
import { logout } from '../../auth/services/auth.service'
import { useTheme } from '../../../shared/assets/theme'
import { Button } from '../../../shared/components/Button'
import { PageHeader } from '../../../shared/components/PageHeader'
import { PermissionNotice } from '../../../shared/components/PermissionNotice'
import { UsersView } from '../../users/components/UsersView'
import { RolesView } from '../../roles/components/RolesView'
import { ProfileForm } from '../components/ProfileForm'
import { ChangePasswordForm } from '../components/ChangePasswordForm'
import { SystemPreferencesForm } from '../../preferences'
import { DistributionSettingsForm, FixedExpenseSettingsForm } from '../../income-statement'
import { CashSessionHistory } from '../../dashboard/components/CashSessionHistory'
import { ExpensesPage } from '../../expenses/pages/ExpensesPage'
import { useCurrentUser } from '../../auth/hooks/useCurrentUser'
import { useUrlParam } from '../../../shared/hooks/useUrlParam'
import brandLogo from '../../../shared/assets/logo/LetraAndysVector.svg'
import { navigateTo } from '../../../app/navigation'
import type { AuthUser } from '../../auth/types/auth.types'

type SettingsTab = 'account' | 'business' | 'finance' | 'users' | 'roles' | 'cash-history' | 'expenses'

interface SettingsSection {
  id: SettingsTab
  label: string
  group: string | null
}

/**
 * Old ?tab= values (before grouping them) and where they live now: Mi Perfil, Preferencias and
 * Sesión became "Mi cuenta"; Preferencias del Sistema became "Datos del negocio".
 */
const LEGACY_TABS: Record<string, SettingsTab> = {
  profile: 'account',
  preferences: 'account',
  session: 'account',
  'system-preferences': 'business',
}

/** Cortes de caja and Gastos moved to Administración › Finanzas (for whoever can open it). */
const MOVED_TO_ADMIN: Partial<Record<SettingsTab, string>> = {
  'cash-history': 'cash-history',
  expenses: 'expenses',
}

function sectionsFor(user: AuthUser | null): SettingsSection[] {
  const canManageUsers = hasPermission(user, 'users.read')
  // Without Administración (dashboard.read) these stay here, so nobody loses access to them.
  const hasAdminView = hasPermission(user, 'dashboard.read')
  return [
    { id: 'account', label: 'Mi cuenta', group: null },
    ...(canManageUsers
      ? ([
          { id: 'business', label: 'Datos del negocio', group: 'Negocio' },
          { id: 'finance', label: 'Finanzas', group: 'Negocio' },
          { id: 'users', label: 'Usuarios', group: 'Accesos' },
          { id: 'roles', label: 'Roles y permisos', group: 'Accesos' },
        ] as const)
      : []),
    ...(!hasAdminView && hasPermission(user, 'cash.read') ? ([{ id: 'cash-history', label: 'Cortes de caja', group: 'Operación' }] as const) : []),
    ...(!hasAdminView && hasPermission(user, 'expenses.read') ? ([{ id: 'expenses', label: 'Gastos', group: 'Operación' }] as const) : []),
  ]
}

/** Rewrites an old /settings?tab= link to where that screen lives now (without a new history entry). */
function useLegacySettingsLinks(user: AuthUser | null) {
  useEffect(() => {
    const url = new URL(window.location.href)
    const tab = url.searchParams.get('tab')
    if (!tab) return
    const movedAdminTab = MOVED_TO_ADMIN[tab as SettingsTab]
    if (movedAdminTab && hasPermission(user, 'dashboard.read')) {
      navigateTo(`${APP_ROUTES.dashboard}?view=admin&admin=${movedAdminTab}`, { replace: true })
      return
    }
    const replacement = LEGACY_TABS[tab]
    if (replacement) {
      if (replacement === 'account') url.searchParams.delete('tab')
      else url.searchParams.set('tab', replacement)
      navigateTo(`${url.pathname}${url.search}`, { replace: true })
    }
  }, [user])
}

export function SettingsPage() {
  const currentUser = useCurrentUser()
  useLegacySettingsLinks(currentUser)

  const sections = sectionsFor(currentUser)
  const [activeTab, setActiveTab] = useUrlParam<SettingsTab>('tab', sections.map((s) => s.id), 'account')
  const canEditSettings = hasPermission(currentUser, SETTINGS_PERMISSION)

  const content: Record<SettingsTab, () => ReactNode> = {
    account: () => <AccountPanel currentUser={currentUser} />,
    business: () => (
      <>
        <PageHeader title="Datos del negocio" description="Nombre, contacto y horario con el que opera la cafetería." />
        <SystemPreferencesForm canEdit={canEditSettings} />
      </>
    ),
    finance: () => (
      <>
        <PageHeader title="Finanzas" description="Cómo se reparte la ganancia diaria y qué gastos fijos se descuentan en el Estado de Resultados." />
        {!hasPermission(currentUser, 'dashboard.read') ? (
          <PermissionNotice action="consultar la configuración de finanzas (requiere acceso a Administración)" />
        ) : (
          <div className="space-y-4">
            {!canEditSettings && <PermissionNotice action="cambiar la configuración de finanzas" />}
            <Panel>
              <DistributionSettingsForm canEdit={canEditSettings} />
            </Panel>
            <Panel>
              <FixedExpenseSettingsForm canEdit={canEditSettings} />
            </Panel>
          </div>
        )}
      </>
    ),
    users: () => <UsersView currentUser={currentUser} />,
    roles: () => <RolesView currentUser={currentUser} />,
    'cash-history': () => <CashSessionHistory canCorrect={hasPermission(currentUser, 'cash.correct')} />,
    expenses: () => <ExpensesPage />,
  }

  const groups = sections.reduce<{ group: string | null; items: SettingsSection[] }[]>((acc, section) => {
    const last = acc[acc.length - 1]
    if (last && last.group === section.group) last.items.push(section)
    else acc.push({ group: section.group, items: [section] })
    return acc
  }, [])

  return (
    <div
      className="min-h-screen"
      style={{ background: 'radial-gradient(circle at top, var(--color-surface) 0%, var(--color-background) 100%)' }}
    >
      <header
        className="border-b px-4 py-4 shadow-[var(--shadow-header)] backdrop-blur sm:px-6"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'color-mix(in srgb, var(--color-surface) 95%, transparent)' }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-15 w-15 items-center justify-center rounded-2xl border p-2 shadow-sm"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
            >
              <img src={brandLogo} alt="Andys Coffee" className="h-8 w-auto object-contain" />
            </div>
            <div>
              <p className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Configuración</p>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {currentUser?.name} · {currentUser?.roleName || 'Usuario'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigateTo(APP_ROUTES.dashboard)}
            className="rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-[var(--color-surface-hover)]"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
          >
            ← Volver al dashboard
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-6 p-4 sm:p-6 lg:grid-cols-4">
          {/* Below lg the menu becomes one scrollable row, so the content stays in view (tablet). */}
          <nav aria-label="Secciones de configuración" className="lg:col-span-1">
            <div
              className="flex gap-1 overflow-x-auto rounded-2xl border p-2 shadow-[var(--shadow-panel)] lg:block lg:space-y-1 lg:p-3"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
            >
              {groups.map(({ group, items }) => (
                <div key={group ?? 'personal'} className="flex shrink-0 gap-1 lg:block lg:space-y-1">
                  {group && (
                    <p className="hidden px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide lg:block" style={{ color: 'var(--color-text-secondary)' }}>
                      {group}
                    </p>
                  )}
                  {items.map((section) => (
                    <NavTab key={section.id} label={section.label} isActive={activeTab === section.id} onClick={() => setActiveTab(section.id)} />
                  ))}
                </div>
              ))}
            </div>
          </nav>

          <div className="min-w-0 lg:col-span-3">{content[activeTab]()}</div>
        </div>
      </main>
    </div>
  )
}

function NavTab({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-current={isActive ? 'page' : undefined}
      onClick={onClick}
      className="block shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition hover:bg-[var(--color-surface-hover)] lg:w-full"
      style={{
        backgroundColor: isActive ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : undefined,
        color: isActive ? 'var(--color-primary)' : 'var(--color-text-primary)',
      }}
    >
      {label}
    </button>
  )
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
      {children}
    </div>
  )
}

/** Mi cuenta: profile, password, appearance and logout on one page (they were three tabs). */
function AccountPanel({ currentUser }: { currentUser: AuthUser | null }) {
  const { mode, setTheme } = useTheme()

  // Logging out never touches the cash drawer: the cut must be done with the real counted
  // cash from "Cierre de caja" (closing it here with the expected amount hid shortages).
  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      // The local session is cleared even if the API is unavailable.
    }
    authStore.clearSession()
    navigateTo(APP_ROUTES.login, { replace: true })
  }

  return (
    <>
      <PageHeader title="Mi cuenta" description="Tu nombre, tu contraseña y cómo se ve el sistema en este equipo." />
      <div className="space-y-4">
        <Panel>
          <ProfileForm currentUser={currentUser} />
        </Panel>
        <Panel>
          <ChangePasswordForm />
        </Panel>
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Apariencia</h2>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Se aplica al momento y se recuerda en este equipo.</p>
            </div>
            <div role="group" aria-label="Tema" className="grid grid-cols-2 gap-1 rounded-xl border p-1" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}>
              {(['light', 'dark'] as const).map((value) => {
                const selected = mode === value
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setTheme(value)}
                    className="min-h-10 rounded-lg px-4 text-sm font-semibold transition"
                    style={{
                      backgroundColor: selected ? 'var(--color-primary)' : 'transparent',
                      color: selected ? 'var(--color-button-text)' : 'var(--color-text-primary)',
                    }}
                  >
                    {value === 'light' ? 'Claro' : 'Oscuro'}
                  </button>
                )
              })}
            </div>
          </div>
        </Panel>
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Cerrar sesión</h2>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {currentUser?.email || 'Sin correo registrado'} · {currentUser?.roleName || 'Usuario'}. La caja no se cierra al salir.
              </p>
            </div>
            <Button variant="secondary" onClick={handleLogout}>
              Cerrar sesión
            </Button>
          </div>
        </Panel>
      </div>
    </>
  )
}
