import React from 'react';
import { PeriodSwitcher, type ViewMode } from '../components/PeriodSwitcher';
import { MovimientosDelDiaSection } from '../components/MovimientosDelDiaSection';
import { ConciliacionCajaSection } from '../components/ConciliacionCajaSection';
import { DistribucionSection } from '../components/DistribucionSection';
import { SaldosAcumuladosSection } from '../components/SaldosAcumuladosSection';
import { WeekTable } from '../components/WeekTable';
import { MonthTable } from '../components/MonthTable';
import { RangeTable } from '../components/RangeTable';
import { DayDetailDrawer } from '../components/DayDetailDrawer';
import { getTodayDateString, getCurrentYearMonth } from '../../../shared/utils/dateUtils';
import {
  useIncomeStatementDay,
  useIncomeStatementWeek,
  useIncomeStatementMonth,
  useIncomeStatementRange,
} from '../hooks/useIncomeStatement';
import { TableSkeleton } from '../../../shared/components/TableSkeleton';
import { PageHeader } from '../../../shared/components/PageHeader';
import { QueryErrorState } from '../../../shared/components/QueryErrorState';
import { navigateTo } from '../../../app/navigation';
import { APP_ROUTES } from '../../../shared/constants/routes';
import { useCurrentUser } from '../../auth/hooks/useCurrentUser';
import { hasPermission, SETTINGS_PERMISSION } from '../../auth/utils/permissions';

export function IncomeStatementPage() {
  // The split and the fixed expenses are configured in Configuración › Finanzas (settings.manage).
  const canConfigure = hasPermission(useCurrentUser(), SETTINGS_PERMISSION);
  const [viewMode, setViewMode] = React.useState<ViewMode>('day');
  const [date, setDate] = React.useState(getTodayDateString());
  const [month, setMonth] = React.useState(getCurrentYearMonth());
  const [rangeFrom, setRangeFrom] = React.useState(getTodayDateString());
  const [rangeTo, setRangeTo] = React.useState(getTodayDateString());
  const [drawerDate, setDrawerDate] = React.useState<string | null>(null);

  const dayQuery = useIncomeStatementDay(date, undefined, viewMode === 'day');
  const weekQuery = useIncomeStatementWeek(date, undefined, viewMode === 'week');
  const monthQuery = useIncomeStatementMonth(month, undefined, viewMode === 'month');
  const rangeQuery = useIncomeStatementRange(rangeFrom, rangeTo, undefined, viewMode === 'range');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Estado de resultados"
        description="Reporte financiero operativo basado en caja, ventas y gastos reales."
        actions={
          canConfigure && (
            <button
              type="button"
              onClick={() => navigateTo(`${APP_ROUTES.settings}?tab=finance`)}
              className="text-sm font-medium hover:underline"
              style={{ color: 'var(--color-primary)' }}
            >
              Configurar distribución y gastos fijos →
            </button>
          )
        }
      />

      <PeriodSwitcher
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        date={date}
        onDateChange={setDate}
        month={month}
        onMonthChange={setMonth}
        rangeFrom={rangeFrom}
        rangeTo={rangeTo}
        onRangeFromChange={setRangeFrom}
        onRangeToChange={setRangeTo}
      />

      {viewMode === 'day' && (
        <>
          {dayQuery.isLoading && <TableSkeleton rows={4} columns={2} />}
          {dayQuery.error && (
            <QueryErrorState error={dayQuery.error} subject="el reporte del día" onRetry={() => void dayQuery.refetch()} isRetrying={dayQuery.isFetching} />
          )}
          {dayQuery.data && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <MovimientosDelDiaSection summary={dayQuery.data} />
              <ConciliacionCajaSection summary={dayQuery.data} />
              <DistribucionSection summary={dayQuery.data} />
              <SaldosAcumuladosSection summary={dayQuery.data} />
            </div>
          )}
        </>
      )}

      {viewMode === 'week' && (
        <>
          {weekQuery.isLoading && <TableSkeleton rows={6} columns={5} />}
          {weekQuery.error && (
            <QueryErrorState error={weekQuery.error} subject="el reporte semanal" onRetry={() => void weekQuery.refetch()} isRetrying={weekQuery.isFetching} />
          )}
          {weekQuery.data && <WeekTable week={weekQuery.data} onSelectDay={setDrawerDate} />}
        </>
      )}

      {viewMode === 'month' && (
        <>
          {monthQuery.isLoading && <TableSkeleton rows={6} columns={5} />}
          {monthQuery.error && (
            <QueryErrorState error={monthQuery.error} subject="el reporte mensual" onRetry={() => void monthQuery.refetch()} isRetrying={monthQuery.isFetching} />
          )}
          {monthQuery.data && <MonthTable month={monthQuery.data} onSelectDay={setDrawerDate} />}
        </>
      )}

      {viewMode === 'range' && (
        <>
          {rangeFrom > rangeTo && (
            <p style={{ color: 'var(--color-danger)' }}>La fecha inicial debe ser menor o igual a la fecha final.</p>
          )}
          {rangeQuery.isLoading && <TableSkeleton rows={6} columns={5} />}
          {rangeQuery.error && (
            <QueryErrorState error={rangeQuery.error} subject="el reporte del rango" onRetry={() => void rangeQuery.refetch()} isRetrying={rangeQuery.isFetching} />
          )}
          {rangeQuery.data && <RangeTable range={rangeQuery.data} onSelectDay={setDrawerDate} />}
        </>
      )}

      <DayDetailDrawer date={drawerDate} onClose={() => setDrawerDate(null)} />
    </div>
  );
}
