import type { MonthFinancialResponse } from '../api/income-statement.api';
import { FinancialPivotTable } from './FinancialPivotTable';

export function MonthTable({ month, onSelectDay }: { month: MonthFinancialResponse; onSelectDay: (date: string) => void }) {
  const columnLabels = month.days.map((d) => String(Number(d.date.slice(-2))));
  return <FinancialPivotTable days={month.days} columnLabels={columnLabels} totals={month.totals} onSelectDay={onSelectDay} />;
}
