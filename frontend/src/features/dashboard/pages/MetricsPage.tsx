import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AdminOverview } from '../components/AdminOverview'
import { CashSessionHistory } from '../components/CashSessionHistory'
import { IncomeStatementPage } from '../../income-statement'
import { PendingPaymentsPage } from '../../pending-payments'
import { PendingDeliveriesPage } from '../../deliveries'
import { DailyOrdersPage } from '../../daily-orders'
import { ExpensesPage } from '../../expenses/pages/ExpensesPage'
import { hasPermission } from '../../auth/utils/permissions'
import { useCurrentUser } from '../../auth/hooks/useCurrentUser'
import { useUrlParam } from '../../../shared/hooks/useUrlParam'
import { usePrevious } from '../../../shared/hooks/usePrevious'
import { SectionTabs } from '../../../shared/components/SectionTabs'
import { SegmentedTabs } from '../../../shared/components/SegmentedTabs'
import type { AuthUser } from '../../auth/types/auth.types'

/** The views; their ids are the ?admin= values used by links (the old ones are kept). */
type AdminView =
  | 'metrics'
  | 'income-statement'
  | 'expenses'
  | 'cash-history'
  | 'pending-payments'
  | 'pending-deliveries'
  | 'daily-orders'

interface AdminSection {
  id: 'summary' | 'finance' | 'pending'
  label: string
  views: { id: AdminView; label: string; permission: string | null; render: (user: AuthUser | null) => ReactNode }[]
}

/**
 * Three sections instead of five flat tabs: the analysis (Resumen), the money records (Finanzas)
 * and the day's pending tasks (Pendientes). The whole view already requires dashboard.read.
 */
const SECTIONS: AdminSection[] = [
  {
    id: 'summary',
    label: 'Resumen',
    views: [{ id: 'metrics', label: 'Resumen', permission: null, render: () => <AdminOverview /> }],
  },
  {
    id: 'finance',
    label: 'Finanzas',
    views: [
      { id: 'income-statement', label: 'Estado de resultados', permission: null, render: () => <IncomeStatementPage /> },
      { id: 'expenses', label: 'Gastos', permission: 'expenses.read', render: () => <ExpensesPage /> },
      {
        id: 'cash-history',
        label: 'Cortes de caja',
        permission: 'cash.read',
        render: (user) => <CashSessionHistory canCorrect={hasPermission(user, 'cash.correct')} />,
      },
    ],
  },
  {
    id: 'pending',
    label: 'Pendientes',
    // Their lists (and settling / handing off) are sales endpoints: GET needs sales.read.
    views: [
      { id: 'pending-payments', label: 'Cuentas por cobrar', permission: 'sales.read', render: () => <PendingPaymentsPage /> },
      { id: 'pending-deliveries', label: 'Mandaditos', permission: 'sales.read', render: () => <PendingDeliveriesPage /> },
      { id: 'daily-orders', label: 'Órdenes del día', permission: 'sales.read', render: () => <DailyOrdersPage /> },
    ],
  },
]

const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 100 : -100, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir < 0 ? 100 : -100, opacity: 0 }),
}

export function MetricsPage() {
  const currentUser = useCurrentUser()
  const sections = SECTIONS.map((section) => ({
    ...section,
    views: section.views.filter((view) => view.permission === null || hasPermission(currentUser, view.permission)),
  })).filter((section) => section.views.length > 0)
  const visibleIds = sections.flatMap((section) => section.views.map((view) => view.id))

  // Kept in the URL (?admin=…): a reload stays on the view and Back returns to the previous one.
  const [activeView, setActiveView] = useUrlParam<AdminView>('admin', visibleIds, 'metrics')
  const activeSection = sections.find((section) => section.views.some((view) => view.id === activeView)) ?? sections[0]
  const active = activeSection.views.find((view) => view.id === activeView) ?? activeSection.views[0]
  const previousSection = usePrevious(activeSection.id)
  const order = sections.map((section) => section.id)
  const direction = previousSection && order.indexOf(activeSection.id) < order.indexOf(previousSection) ? -1 : 1

  return (
    <div>
      <SectionTabs
        ariaLabel="Secciones de administración"
        items={sections}
        value={activeSection.id}
        onChange={(id) => setActiveView((sections.find((section) => section.id === id) ?? sections[0]).views[0].id)}
      />

      <div className="pt-5">
        {activeSection.views.length > 1 && (
          <SegmentedTabs
            className="mb-5"
            ariaLabel={`Vistas de ${activeSection.label}`}
            items={activeSection.views}
            value={active.id}
            onChange={setActiveView}
          />
        )}

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={`${activeSection.id}-section`}
            role="tabpanel"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
          >
            <div key={active.id}>{active.render(currentUser)}</div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
