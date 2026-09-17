import type { RangeFinancialResponse } from '../api/income-statement.api';
import { FinancialPivotTable } from './FinancialPivotTable';

export function RangeTable({ range, onSelectDay }: { range: RangeFinancialResponse; onSelectDay: (date: string) => void }) {
  const columnLabels = range.days.map((d) => {
    const [, month, day] = d.date.split('-');
    return `${day}/${month}`;
  });
  return <FinancialPivotTable days={range.days} columnLabels={columnLabels} totals={range.totals} onSelectDay={onSelectDay} />;
}
