import type { WeekFinancialResponse } from '../api/income-statement.api';
import { FinancialPivotTable } from './FinancialPivotTable';

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function WeekTable({ week, onSelectDay }: { week: WeekFinancialResponse; onSelectDay: (date: string) => void }) {
  return <FinancialPivotTable days={week.days} columnLabels={WEEKDAY_LABELS} onSelectDay={onSelectDay} />;
}
