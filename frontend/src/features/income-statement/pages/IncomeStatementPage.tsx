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
import {
  useIncomeStatementDay,
  useIncomeStatementWeek,
  useIncomeStatementMonth,
  useIncomeStatementRange,
} from '../hooks/useIncomeStatement';

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function currentYearMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function IncomeStatementPage() {
  const [viewMode, setViewMode] = React.useState<ViewMode>('day');
  const [date, setDate] = React.useState(todayDateString());
  const [month, setMonth] = React.useState(currentYearMonth());
  const [rangeFrom, setRangeFrom] = React.useState(todayDateString());
  const [rangeTo, setRangeTo] = React.useState(todayDateString());
  const [drawerDate, setDrawerDate] = React.useState<string | null>(null);

  const dayQuery = useIncomeStatementDay(date, undefined, viewMode === 'day');
  const weekQuery = useIncomeStatementWeek(date, undefined, viewMode === 'week');
  const monthQuery = useIncomeStatementMonth(month, undefined, viewMode === 'month');
  const rangeQuery = useIncomeStatementRange(rangeFrom, rangeTo, undefined, viewMode === 'range');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Estado de Resultados
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Reporte financiero operativo basado en caja, ventas y gastos reales
          </p>
        </div>
      </div>

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
          {dayQuery.isLoading && <p style={{ color: 'var(--color-text-secondary)' }}>Cargando…</p>}
          {dayQuery.error && <p style={{ color: 'var(--color-danger)' }}>Error al cargar el reporte del día.</p>}
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
          {weekQuery.isLoading && <p style={{ color: 'var(--color-text-secondary)' }}>Cargando…</p>}
          {weekQuery.error && <p style={{ color: 'var(--color-danger)' }}>Error al cargar el reporte semanal.</p>}
          {weekQuery.data && <WeekTable week={weekQuery.data} onSelectDay={setDrawerDate} />}
        </>
      )}

      {viewMode === 'month' && (
        <>
          {monthQuery.isLoading && <p style={{ color: 'var(--color-text-secondary)' }}>Cargando…</p>}
          {monthQuery.error && <p style={{ color: 'var(--color-danger)' }}>Error al cargar el reporte mensual.</p>}
          {monthQuery.data && <MonthTable month={monthQuery.data} onSelectDay={setDrawerDate} />}
        </>
      )}

      {viewMode === 'range' && (
        <>
          {rangeFrom > rangeTo && (
            <p style={{ color: 'var(--color-danger)' }}>La fecha inicial debe ser menor o igual a la fecha final.</p>
          )}
          {rangeQuery.isLoading && <p style={{ color: 'var(--color-text-secondary)' }}>Cargando…</p>}
          {rangeQuery.error && <p style={{ color: 'var(--color-danger)' }}>Error al cargar el reporte del rango.</p>}
          {rangeQuery.data && <RangeTable range={rangeQuery.data} onSelectDay={setDrawerDate} />}
        </>
      )}

      <DayDetailDrawer date={drawerDate} onClose={() => setDrawerDate(null)} />
    </div>
  );
}
