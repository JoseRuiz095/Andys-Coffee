import { Skeleton } from '../../../shared/components/Skeleton'
import { OrderListSection } from '../components/OrderListSection'
import { MenuSection } from '../components/MenuSection'
import { OrderDetailsPanel } from '../components/OrderDetailsPanel'
import React from 'react'

export function DashboardPage() {
  const [isLoading] = React.useState(true)
  const [selectedOrderId, setSelectedOrderId] = React.useState<string>()

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
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            {isLoading ? (
              <>
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-6 w-24" />
              </>
            ) : (
              <>
                <div className="h-8 w-8 rounded-full bg-amber-500" />
                <span className="font-bold text-slate-900">Kopag</span>
              </>
            )}
          </div>

          <nav className="flex gap-6">
            {['Dashboard', 'Order List', 'History', 'Bills'].map((item) =>
              isLoading ? (
                <Skeleton key={item} className="h-4 w-20" />
              ) : (
                <button
                  key={item}
                  className="text-sm font-medium text-slate-600 hover:text-blue-500"
                >
                  {item}
                </button>
              ),
            )}
          </nav>

          <div className="flex items-center gap-4">
            {isLoading ? (
              <>
                <Skeleton className="h-6 w-6" />
                <Skeleton className="h-10 w-10 rounded-full" />
              </>
            ) : (
              <>
                <button className="relative">
                  <span className="text-xl">🔔</span>
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
                </button>
                <div className="h-10 w-10 rounded-full bg-slate-300" />
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl p-6">
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
