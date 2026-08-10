import { Skeleton } from '../../../shared/components/Skeleton'
import brandLogo from '../../../shared/assets/logo/LetraAndysVector.svg'
import { OrderListSection } from '../components/OrderListSection'
import { MenuSection } from '../components/MenuSection'
import { OrderDetailsPanel } from '../components/OrderDetailsPanel'
import { authStore } from '../../auth/store/auth.store'
import type { AuthUser } from '../../auth/types/auth.types'
import React from 'react'

export function DashboardPage() {
  const [isLoading] = React.useState(false)
  const [selectedOrderId, setSelectedOrderId] = React.useState<string>()
  const [currentUser, setCurrentUser] = React.useState<AuthUser | null>(authStore.getState().user)

  React.useEffect(() => {
    const syncUser = () => setCurrentUser(authStore.getState().user)

    syncUser()
    window.addEventListener('auth:changed', syncUser)

    return () => window.removeEventListener('auth:changed', syncUser)
  }, [])

  const displayName = currentUser?.name ?? 'Usuario'
  const rawRoleName = currentUser?.roleName ?? currentUser?.roleId ?? ''
  const roleLabel = rawRoleName.toUpperCase() === 'ADMIN'
    ? 'Administrador'
    : rawRoleName.toUpperCase() === 'CAJERO'
      ? 'Cajero'
      : rawRoleName.toUpperCase() === 'ADMINISTRADOR'
        ? 'Administrador'
        : rawRoleName.toUpperCase() === 'CAJERO'
          ? 'Cajero'
          : currentUser?.roleId
            ? 'Usuario'
            : 'Usuario'
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U'

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffffff_0%,_#f8fafc_45%,_#e2e8f0_100%)] px-6 py-6">
        <div className="mx-auto max-w-7xl rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          {/* Grid principal del skeleton del dashboard */}
          <div
            className="grid min-h-[620px] gap-3"
            style={{
              gridTemplateColumns: 'repeat(5, 1fr)',
              gridTemplateRows: 'auto auto auto auto auto',
            }}
          >
            {/* Barra superior de navegacion: logo, botones y acciones */}
            <div
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-1"
              style={{ gridArea: '1 / 1 / 2 / 6' }}
            >
              {/* Logo de la marca */}
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div>
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>

              {/* Botones de navegacion */}
              <div className="hidden items-center gap-3 lg:flex">
                {['Dashboard', 'Ordenes', 'Historial', 'Ventas'].map((item) => (
                  <Skeleton key={item} className="h-3.5 w-16 rounded-full" />
                ))}
              </div>

              {/* Acciones rapidas: alertas y configuracion */}
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            </div>

            {/* Panel lateral derecho: detalles de la orden y resumen */}
            <div
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              style={{ gridArea: '2 / 5 / 5 / 6' }}
            >
              {/* Encabezado del panel de detalle */}
              <Skeleton className="mb-4 h-5 w-32" />
              {/* Lista de items del pedido */}
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="flex gap-3 rounded-xl bg-slate-50 p-3">
                    <Skeleton className="h-12 w-12 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-5 w-12" />
                  </div>
                ))}
              </div>

              {/* Resumen de totales y boton final */}
              <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-14" />
                </div>
                <div className="border-t border-slate-200" />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-11 w-full rounded-xl bg-blue-500" />
              </div>
            </div>

            {/* Seccion de categorias y cards destacadas */}
            <div
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              style={{ gridArea: '2 / 1 / 3 / 5' }}
            >
              {/* Filtros por categoria */}
              <div className="mb-4 flex flex-wrap gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-28 rounded-lg" />
                ))}
              </div>
              {/* Tarjetas de productos en formato compacto */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-2xl border border-slate-200 p-3">
                    <Skeleton className="h-28 w-full rounded-xl" />
                    <div className="mt-3 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                      <div className="flex items-center justify-between pt-1">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lista principal de productos */}
            <div
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              style={{ gridArea: '3 / 1 / 5 / 5' }}
            >
              {/* Encabezado de la lista */}
              <div className="mb-4 flex items-center justify-between">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-24" />
              </div>

              {/* Cards de productos */}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="overflow-hidden rounded-2xl border border-slate-200">
                    <Skeleton className="h-40 w-full" />
                    <div className="space-y-3 p-4">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-full" />
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <div className="flex gap-2">
                        <Skeleton className="h-8 w-8 rounded-lg" />
                        <Skeleton className="h-8 flex-1 rounded-lg" />
                        <Skeleton className="h-8 w-8 rounded-lg bg-blue-500" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#FCF8EF_0%,_#F7F2E8_100%)]">
      <header className="border-b border-[#E7E3DC] bg-[#FDFBF7]/95 px-4 py-4 shadow-[0_8px_30px_rgba(45,33,29,0.05)] backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {isLoading ? (
              <>
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-6 w-24" />
              </>
            ) : (
              <>
                <div className="flex h-15 w-15 items-center justify-center rounded-2xl border border-[#E7E3DC] bg-[#F3E8D6] p-2 shadow-sm">
                  <img src={brandLogo} alt="Andys Coffee" className="h-8 w-auto object-contain" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#2C211D]">{displayName}</div>
                  <div className="text-xs text-[#6B7280]">{roleLabel}</div>
                </div>
              </>
            )}
          </div>

          <nav className="flex flex-wrap items-center gap-2 rounded-full border border-[#E7E3DC] bg-white/80 px-3 py-2 shadow-sm">
            {['Dashboard', 'Ordenes', 'Historial', 'Ventas'].map((item) =>
              isLoading ? (
                <Skeleton key={item} className="h-4 w-20" />
              ) : (
                <button
                  key={item}
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-[#4B5563] transition hover:bg-[#F2EFE8] hover:text-[#5A804F]"
                >
                  {item}
                </button>
              ),
            )}
          </nav>

          <div className="flex items-center gap-3">
            {isLoading ? (
              <>
                <Skeleton className="h-6 w-6" />
                <Skeleton className="h-10 w-10 rounded-full" />
              </>
            ) : (
              <>
                <button className="relative rounded-full border border-[#E7E3DC] bg-white p-2.5 text-lg shadow-sm">
                  <span>🔔</span>
                  <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#5A804F]" />
                </button>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#5A804F] font-semibold text-white shadow-sm">
                  {initials}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        <div className="mb-6 rounded-[1.75rem] border border-[#E7E3DC] bg-[#FDFBF7] p-5 shadow-[0_20px_50px_rgba(45,33,29,0.06)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#5A804F]">Operación del día</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#2C211D]">Gestiona órdenes y productos con una vista más clara</h2>
            </div>
            <div className="rounded-full border border-[#E7E3DC] bg-[#F2EFE8] px-3 py-1.5 text-sm text-[#4B5563]">
              {roleLabel}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr_320px]">
          {/* LEFT: Order List */}
          <OrderListSection
            isLoading={isLoading}
            selectedOrderId={selectedOrderId}
            onSelectOrder={setSelectedOrderId}
          />

          {/* CENTER: Menu & Products */}
          <MenuSection isLoading={isLoading} />

          {/* RIGHT: Order Details & Summary */}
          <OrderDetailsPanel isLoading={isLoading} />
        </div>
      </div>
    </div>
  )
}
