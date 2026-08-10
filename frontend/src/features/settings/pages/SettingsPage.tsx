import React from 'react'
import { APP_ROUTES } from '../../../shared/constants/routes'
import { authStore } from '../../auth/store/auth.store'
import type { AuthUser } from '../../auth/types/auth.types'
import brandLogo from '../../../shared/assets/logo/LetraAndysVector.svg'
import { SettingsIcon } from '../../../components/ui/settings'

type AdminPanel = 'users' | 'roles'

type ManagedUser = {
  id: string
  name: string
  email: string
  phone: string
  registeredAt: string
  role: 'ADMIN' | 'CAJERO'
  isActive: boolean
}

type RolePermission = {
  id: string
  label: string
  admin: boolean
  cashier: boolean
}

function getRoleKey(user: AuthUser | null) {
  return (user?.roleName ?? user?.roleId ?? '').trim().toUpperCase()
}

function getRoleLabel(roleKey: string) {
  if (roleKey === 'ADMIN' || roleKey === 'ADMINISTRADOR') {
    return 'Administrador'
  }

  if (roleKey === 'CAJERO') {
    return 'Cajero'
  }

  return 'Usuario'
}

function navigateTo(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function SettingsPage() {
  const [currentUser, setCurrentUser] = React.useState<AuthUser | null>(authStore.getState().user)
  const [activePanel, setActivePanel] = React.useState<AdminPanel>('users')
  const [selectedUserId, setSelectedUserId] = React.useState(() => authStore.getState().user?.id ?? 'current-user')
  const [selectedAction, setSelectedAction] = React.useState('edit-profile')
  const [managedUsers, setManagedUsers] = React.useState<ManagedUser[]>(() => [
    {
      id: authStore.getState().user?.id ?? 'current-user',
      name: authStore.getState().user?.name ?? 'Administrador',
      email: authStore.getState().user?.email ?? 'admin@andyscoffee.local',
      phone: '+52 (656) 100-0000',
      registeredAt: '10 de Agosto, 2026',
      role: 'ADMIN',
      isActive: true,
    },
    {
      id: 'cashier-demo',
      name: 'Caja principal',
      email: 'caja@andyscoffee.local',
      phone: '+52 (656) 200-0000',
      registeredAt: '10 de Agosto, 2026',
      role: 'CAJERO',
      isActive: true,
    },
  ])
  const [permissions, setPermissions] = React.useState<RolePermission[]>([
    { id: 'users.read', label: 'Consultar usuarios', admin: true, cashier: false },
    { id: 'users.create', label: 'Crear usuarios', admin: true, cashier: false },
    { id: 'users.update', label: 'Actualizar usuarios', admin: true, cashier: false },
    { id: 'users.delete', label: 'Eliminar usuarios', admin: true, cashier: false },
    { id: 'products.read', label: 'Consultar productos', admin: true, cashier: true },
    { id: 'products.update', label: 'Actualizar productos', admin: true, cashier: false },
    { id: 'sales.read', label: 'Consultar ventas', admin: true, cashier: true },
    { id: 'sales.create', label: 'Crear ventas', admin: true, cashier: true },
    { id: 'sales.cancel', label: 'Cancelar ventas', admin: true, cashier: false },
    { id: 'cash.open', label: 'Abrir caja', admin: true, cashier: true },
    { id: 'cash.close', label: 'Cerrar caja', admin: true, cashier: true },
    { id: 'reports.read', label: 'Consultar reportes', admin: true, cashier: false },
  ])

  React.useEffect(() => {
    const syncUser = () => setCurrentUser(authStore.getState().user)

    window.addEventListener('auth:changed', syncUser)

    return () => window.removeEventListener('auth:changed', syncUser)
  }, [])

  const roleKey = getRoleKey(currentUser)
  const roleLabel = getRoleLabel(roleKey)
  const isAdmin = roleKey === 'ADMIN' || roleKey === 'ADMINISTRADOR'
  const selectedUser = managedUsers.find((user) => user.id === selectedUserId) ?? managedUsers[0]
  const userActions = [
    {
      id: 'edit-profile',
      icon: 'P',
      title: 'Editar perfil',
      description: 'Actualizar informacion personal',
    },
    {
      id: 'change-role',
      icon: 'R',
      title: 'Cambiar rol',
      description: 'Asignar Administrador o Cajero',
    },
    {
      id: 'permissions',
      icon: 'A',
      title: 'Accesos y permisos',
      description: 'Revisar permisos disponibles',
    },
    {
      id: 'status',
      icon: selectedUser?.isActive ? '!' : '+',
      title: selectedUser?.isActive ? 'Desactivar usuario' : 'Activar usuario',
      description: selectedUser?.isActive ? 'Bloquear acceso al sistema' : 'Restaurar acceso al sistema',
    },
  ]

  const handleLogout = () => {
    authStore.clearSession()
    navigateTo(APP_ROUTES.login)
  }

  const updateUserRole = (userId: string, role: ManagedUser['role']) => {
    setManagedUsers((users) => users.map((user) => (user.id === userId ? { ...user, role } : user)))
  }

  const toggleUserStatus = (userId: string) => {
    setManagedUsers((users) =>
      users.map((user) => (user.id === userId ? { ...user, isActive: !user.isActive } : user)),
    )
  }

  const togglePermission = (permissionId: string, role: 'admin' | 'cashier') => {
    setPermissions((currentPermissions) =>
      currentPermissions.map((permission) =>
        permission.id === permissionId ? { ...permission, [role]: !permission[role] } : permission,
      ),
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#FCF8EF_0%,_#F7F2E8_100%)]">
      <header className="border-b border-[#E7E3DC] bg-[#FDFBF7]/95 px-4 py-4 shadow-[0_8px_30px_rgba(45,33,29,0.05)] backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-15 w-15 items-center justify-center rounded-2xl border border-[#E7E3DC] bg-[#F3E8D6] p-2 shadow-sm">
              <img src={brandLogo} alt="Andys Coffee" className="h-8 w-auto object-contain" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#2C211D]">Configuracion</p>
              <p className="text-xs text-[#6B7280]">{roleLabel}</p>
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
              <h1 className="mt-2 text-2xl font-semibold text-[#2C211D]">Configuracion y accesos</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6B7280]">
                {isAdmin
                  ? 'Como administrador puedes gestionar usuarios, roles y permisos del sistema.'
                  : 'Tu rol actual solo permite administrar tu sesion.'}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#E7E3DC] bg-white text-[#5A804F] shadow-sm">
              <SettingsIcon size={24} aria-hidden="true" />
            </div>
          </div>
        </section>

        {isAdmin && (
          <section className="mb-6 rounded-2xl border border-[#E7E3DC] bg-white p-5 shadow-[0_14px_34px_rgba(45,33,29,0.06)]">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5A804F]">Administracion</p>
                <h2 className="mt-2 text-lg font-semibold text-[#2C211D]">Gestion del sistema</h2>
              </div>
              <div className="flex rounded-full border border-[#E7E3DC] bg-[#FDFBF7] p-1">
                <button
                  type="button"
                  onClick={() => setActivePanel('users')}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    activePanel === 'users' ? 'bg-[#5A804F] text-white shadow-sm' : 'text-[#4B5563] hover:bg-[#F2EFE8]'
                  }`}
                >
                  Gestion de usuarios
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel('roles')}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    activePanel === 'roles' ? 'bg-[#5A804F] text-white shadow-sm' : 'text-[#4B5563] hover:bg-[#F2EFE8]'
                  }`}
                >
                  Roles y permisos
                </button>
              </div>
            </div>

            {activePanel === 'users' ? (
              <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
                <div className="space-y-5">
                  <div className="rounded-2xl border border-[#E7E3DC] bg-[#FDFBF7] p-5">
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5A804F]" htmlFor="user-selector">
                      Seleccionar usuario
                    </label>
                    <select
                      id="user-selector"
                      value={selectedUserId}
                      onChange={(event) => {
                        setSelectedUserId(event.target.value)
                        setSelectedAction('edit-profile')
                      }}
                      className="mt-3 w-full rounded-xl border border-[#E7E3DC] bg-white px-4 py-3 text-sm font-medium text-[#2C211D] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#5A804F]/20"
                    >
                      {managedUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} - {user.role === 'ADMIN' ? 'Administrador' : 'Cajero'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-2xl border border-[#E7E3DC] bg-white p-6">
                    <div className="mb-5 flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F2EFE8] text-sm font-bold text-[#5A804F]">
                        I
                      </span>
                      <h3 className="text-lg font-semibold text-[#2C211D]">Informacion personal</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="border-b border-[#E7E3DC] pb-4">
                        <p className="text-sm text-[#6B7280]">Correo institucional</p>
                        <p className="mt-1 text-base font-semibold text-[#2C211D]">{selectedUser.email}</p>
                      </div>
                      <div className="border-b border-[#E7E3DC] pb-4">
                        <p className="text-sm text-[#6B7280]">Telefono</p>
                        <p className="mt-1 text-base font-semibold text-[#2C211D]">{selectedUser.phone}</p>
                      </div>
                      <div>
                        <p className="text-sm text-[#6B7280]">Fecha de registro</p>
                        <p className="mt-1 text-base font-semibold text-[#2C211D]">{selectedUser.registeredAt}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#E7E3DC] bg-white p-6">
                    <h3 className="text-lg font-semibold text-[#2C211D]">Accesos rapidos</h3>
                    <div className="mt-5 space-y-3">
                      {userActions.map((action) => (
                        <button
                          key={action.id}
                          type="button"
                          onClick={() => setSelectedAction(action.id)}
                          className={`flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left transition ${
                            selectedAction === action.id ? 'bg-[#F3E8D6]' : 'hover:bg-[#FDFBF7]'
                          }`}
                        >
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ECECEC] text-sm font-bold text-[#2C211D]">
                            {action.icon}
                          </span>
                          <span>
                            <span className="block text-sm font-semibold text-[#2C211D]">{action.title}</span>
                            <span className="block text-sm text-[#6B7280]">{action.description}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E7E3DC] bg-[#FDFBF7] p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5A804F]">Accion seleccionada</p>
                  <h3 className="mt-2 text-xl font-semibold text-[#2C211D]">
                    {userActions.find((action) => action.id === selectedAction)?.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                    Estas opciones modifican al usuario seleccionado: {selectedUser.name}.
                  </p>

                  {selectedAction === 'edit-profile' && (
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      <label className="text-sm font-medium text-[#4B5563]">
                        Nombre
                        <input
                          value={selectedUser.name}
                          onChange={(event) =>
                            setManagedUsers((users) =>
                              users.map((user) => (user.id === selectedUser.id ? { ...user, name: event.target.value } : user)),
                            )
                          }
                          className="mt-2 w-full rounded-xl border border-[#E7E3DC] bg-white px-4 py-3 text-sm text-[#2C211D] focus:outline-none focus:ring-2 focus:ring-[#5A804F]/20"
                        />
                      </label>
                      <label className="text-sm font-medium text-[#4B5563]">
                        Telefono
                        <input
                          value={selectedUser.phone}
                          onChange={(event) =>
                            setManagedUsers((users) =>
                              users.map((user) => (user.id === selectedUser.id ? { ...user, phone: event.target.value } : user)),
                            )
                          }
                          className="mt-2 w-full rounded-xl border border-[#E7E3DC] bg-white px-4 py-3 text-sm text-[#2C211D] focus:outline-none focus:ring-2 focus:ring-[#5A804F]/20"
                        />
                      </label>
                    </div>
                  )}

                  {selectedAction === 'change-role' && (
                    <div className="mt-6 max-w-sm">
                      <label className="text-sm font-medium text-[#4B5563]">
                        Rol del usuario
                        <select
                          value={selectedUser.role}
                          onChange={(event) => updateUserRole(selectedUser.id, event.target.value as ManagedUser['role'])}
                          className="mt-2 w-full rounded-xl border border-[#E7E3DC] bg-white px-4 py-3 text-sm text-[#2C211D] focus:outline-none focus:ring-2 focus:ring-[#5A804F]/20"
                        >
                          <option value="ADMIN">Administrador</option>
                          <option value="CAJERO">Cajero</option>
                        </select>
                      </label>
                    </div>
                  )}

                  {selectedAction === 'permissions' && (
                    <div className="mt-6 grid gap-2 md:grid-cols-2">
                      {permissions
                        .filter((permission) => (selectedUser.role === 'ADMIN' ? permission.admin : permission.cashier))
                        .map((permission) => (
                          <div key={permission.id} className="rounded-xl border border-[#E7E3DC] bg-white px-4 py-3">
                            <p className="text-sm font-semibold text-[#2C211D]">{permission.label}</p>
                            <p className="text-xs text-[#6B7280]">{permission.id}</p>
                          </div>
                        ))}
                    </div>
                  )}

                  {selectedAction === 'status' && (
                    <div className="mt-6 rounded-xl border border-[#E7E3DC] bg-white p-4">
                      <p className="text-sm text-[#6B7280]">Estado actual</p>
                      <p className="mt-1 text-lg font-semibold text-[#2C211D]">
                        {selectedUser.isActive ? 'Usuario activo' : 'Usuario inactivo'}
                      </p>
                      <button
                        type="button"
                        onClick={() => toggleUserStatus(selectedUser.id)}
                        className="mt-4 rounded-xl bg-[#2C211D] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3A2A24]"
                      >
                        {selectedUser.isActive ? 'Desactivar usuario' : 'Activar usuario'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[#EFE8DC]">
                <div className="grid grid-cols-[1.5fr_160px_160px] bg-[#FDFBF7] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#6B7280]">
                  <span>Permiso</span>
                  <span>Admin</span>
                  <span>Cajero</span>
                </div>
                {permissions.map((permission) => (
                  <div
                    key={permission.id}
                    className="grid grid-cols-[1.5fr_160px_160px] items-center border-t border-[#EFE8DC] px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#2C211D]">{permission.label}</p>
                      <p className="text-xs text-[#6B7280]">{permission.id}</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-[#4B5563]">
                      <input
                        type="checkbox"
                        checked={permission.admin}
                        onChange={() => togglePermission(permission.id, 'admin')}
                        className="h-4 w-4 accent-[#5A804F]"
                      />
                      Permitido
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[#4B5563]">
                      <input
                        type="checkbox"
                        checked={permission.cashier}
                        onChange={() => togglePermission(permission.id, 'cashier')}
                        className="h-4 w-4 accent-[#5A804F]"
                      />
                      Permitido
                    </label>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                className="rounded-xl bg-[#2C211D] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3A2A24] focus:outline-none focus:ring-2 focus:ring-[#2C211D]/25"
              >
                Guardar cambios
              </button>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-[#E7E3DC] bg-white p-5 shadow-[0_14px_34px_rgba(45,33,29,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5A804F]">Sesion</p>
          <div className="mt-3 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[#2C211D]">Logout</h2>
              <p className="mt-1 text-sm text-[#6B7280]">
                {currentUser?.email ?? 'Sin correo registrado'} · {roleLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl bg-[#2C211D] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3A2A24] focus:outline-none focus:ring-2 focus:ring-[#2C211D]/25"
            >
              Cerrar sesion
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}
