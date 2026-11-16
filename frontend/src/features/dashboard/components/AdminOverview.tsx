import React from 'react'
import { DashboardSummary } from './DashboardSummary'
import { TopProducts } from './TopProducts'
import { InventoryStatus } from './InventoryStatus'
import { SalesTrendChart } from './SalesTrendChart'
import { CostEvolutionChart } from './CostEvolutionChart'
import { ProductCostsBreakdown } from './ProductCostsBreakdown'
import { ExpensesByCategory } from './ExpensesByCategory'
import { UpcomingInventory } from './UpcomingInventory'
import { RecentMovements } from './RecentMovements'
import { PageHeader } from '../../../shared/components/PageHeader'
import { navigateTo } from '../../../app/navigation'
import { APP_ROUTES } from '../../../shared/constants/routes'
import { hasPermission } from '../../auth/utils/permissions'
import { useCurrentUser } from '../../auth/hooks/useCurrentUser'
import type { PeriodType } from '../hooks/useDashboard'

const PERIODS: { id: PeriodType; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: 'yesterday', label: 'Ayer' },
  { id: 'week', label: '7 días' },
  { id: 'month', label: 'Mes' },
]

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
      {children}
    </h2>
  )
}

/** Administración › Resumen: the period's figures first, then sales, costs and inventory. */
export function AdminOverview() {
  const [period, setPeriod] = React.useState<PeriodType>('today')
  const canSeeInventory = hasPermission(useCurrentUser(), 'inventory.view')

  const inventoryLink = (inv: string | null, label: string) =>
    canSeeInventory ? (
      <button
        type="button"
        onClick={() => navigateTo(`${APP_ROUTES.dashboard}?view=inventario${inv ? `&inv=${inv}` : ''}`)}
        className="text-sm font-medium hover:underline"
        style={{ color: 'var(--color-primary)' }}
      >
        {label} →
      </button>
    ) : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resumen del negocio"
        description="Ventas, costos e inventario del periodo elegido."
        actions={
          <div role="group" aria-label="Periodo" className="flex gap-1 rounded-xl border p-1" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
            {PERIODS.map((p) => {
              const selected = period === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setPeriod(p.id)}
                  className="min-h-9 rounded-lg px-3 text-sm font-medium transition"
                  style={{
                    backgroundColor: selected ? 'var(--color-primary)' : 'transparent',
                    color: selected ? 'var(--color-button-text)' : 'var(--color-text-primary)',
                  }}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        }
      />

      <DashboardSummary
        period={period}
        onOpenInventory={canSeeInventory ? () => navigateTo(`${APP_ROUTES.dashboard}?view=inventario`) : undefined}
      />

      <section>
        <SectionTitle>Ventas</SectionTitle>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SalesTrendChart period={period} />
          <TopProducts period={period} />
        </div>
      </section>

      <section>
        <SectionTitle>Costos y gastos</SectionTitle>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CostEvolutionChart period={period} />
          <ProductCostsBreakdown period={period} />
        </div>
        <div className="mt-4">
          <ExpensesByCategory period={period} />
        </div>
      </section>

      <section>
        <SectionTitle>Inventario</SectionTitle>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <InventoryStatus onlyLow action={inventoryLink(null, 'Existencias')} />
          <UpcomingInventory limit={5} action={inventoryLink('entries', 'Por recibir')} />
          {/* The full history lives in Inventario › Movimientos. */}
          <RecentMovements limit={5} action={inventoryLink('movements', 'Ver todos')} />
        </div>
      </section>
    </div>
  )
}
