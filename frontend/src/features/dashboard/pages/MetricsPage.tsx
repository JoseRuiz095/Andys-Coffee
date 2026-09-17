import React, { useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { DashboardSummary } from '../components/DashboardSummary';
import { TopProducts } from '../components/TopProducts';
import { InventoryStatus } from '../components/InventoryStatus';
import { SalesTrendChart } from '../components/SalesTrendChart';
import { CostEvolutionChart } from '../components/CostEvolutionChart';
import { ProductCostsBreakdown } from '../components/ProductCostsBreakdown';
import { ExpensesByCategory } from '../components/ExpensesByCategory';
import { UpcomingInventory } from '../components/UpcomingInventory';
import { RecentMovements } from '../components/RecentMovements';
import type { PeriodType } from '../hooks/useDashboard';
import { IncomeStatementPage } from '../../income-statement';

type AdminView = 'metrics' | 'income-statement';

function MetricsOverview() {
  const [period, setPeriod] = React.useState<PeriodType>('today');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Dashboard Administrativo
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Métricas y análisis en tiempo real del negocio
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2">
          {(['today', 'yesterday', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-4 py-2 text-sm font-medium rounded-lg transition"
              style={{
                backgroundColor: period === p ? 'var(--color-primary)' : 'var(--color-surface)',
                color: period === p ? 'var(--color-button-text)' : 'var(--color-text-primary)',
                border: `1px solid ${period === p ? 'var(--color-primary)' : 'var(--color-border)'}`,
              }}
            >
              {p === 'today' ? 'Hoy' : p === 'yesterday' ? 'Ayer' : p === 'week' ? '7 días' : 'Mes'}
            </button>
          ))}
        </div>
      </div>

      {/* Resumen */}
      <section>
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Resumen del Día
        </h2>
        <DashboardSummary period={period} />
      </section>

      {/* Ventas */}
      <section>
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Ventas
        </h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SalesTrendChart period={period} />
          <TopProducts period={period} />
        </div>
      </section>

      {/* Finanzas y Costos */}
      <section>
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Finanzas y Costos
        </h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CostEvolutionChart period={period} />
          <ProductCostsBreakdown period={period} />
        </div>
        <div className="mt-6">
          <ExpensesByCategory period={period} />
        </div>
      </section>

      {/* Inventario */}
      <section>
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Inventario
        </h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <InventoryStatus onlyLow={true} />
          <UpcomingInventory limit={10} />
        </div>
        <div className="mt-6">
          <RecentMovements limit={20} />
        </div>
      </section>
    </div>
  );
}

export function MetricsPage() {
  const [activeView, setActiveView] = React.useState<AdminView>('metrics');
  const prevViewRef = useRef<AdminView>(activeView);

  const views: AdminView[] = ['metrics', 'income-statement'];
  const currentIndex = views.indexOf(activeView);
  const prevIndex = views.indexOf(prevViewRef.current);
  const direction = currentIndex > prevIndex ? 1 : -1;

  const handleViewChange = (view: AdminView) => {
    prevViewRef.current = activeView;
    setActiveView(view);
  };

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 100 : -100, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir < 0 ? 100 : -100, opacity: 0 }),
  };

  return (
    <div>
      {/* Sub-navigation */}
      <div
        className="sticky top-0 z-10 mb-6 border-b overflow-x-auto"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <nav className="flex gap-1 min-w-max md:min-w-0">
          <button
            onClick={() => handleViewChange('metrics')}
            className="border-b-2 px-4 py-3 text-sm font-medium transition-colors"
            style={{
              borderColor: activeView === 'metrics' ? 'var(--color-primary)' : 'transparent',
              color: activeView === 'metrics' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            }}
          >
            Dashboard
          </button>
          <button
            onClick={() => handleViewChange('income-statement')}
            className="border-b-2 px-4 py-3 text-sm font-medium transition-colors"
            style={{
              borderColor: activeView === 'income-statement' ? 'var(--color-primary)' : 'transparent',
              color: activeView === 'income-statement' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            }}
          >
            Estado de Resultados
          </button>
        </nav>
      </div>

      <AnimatePresence mode="wait" custom={direction}>
        {activeView === 'metrics' && (
          <motion.div
            key="metrics-view"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <MetricsOverview />
          </motion.div>
        )}
        {activeView === 'income-statement' && (
          <motion.div
            key="income-statement-view"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <IncomeStatementPage />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
