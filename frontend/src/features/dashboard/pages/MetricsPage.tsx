import React from 'react';
import { DashboardSummary } from '../components/DashboardSummary';
import { TopProducts } from '../components/TopProducts';
import { InventoryStatus } from '../components/InventoryStatus';
import { CostsOverview } from '../components/CostsOverview';
import type { PeriodType } from '../hooks/useDashboard';

export function MetricsPage() {
  const [period, setPeriod] = React.useState<PeriodType>('today');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Dashboard
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

      {/* Summary KPIs */}
      <DashboardSummary period={period} />

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Products */}
        <TopProducts period={period} />

        {/* Costs */}
        <CostsOverview period={period} />
      </div>

      {/* Inventory */}
      <InventoryStatus onlyLow={true} />
    </div>
  );
}
