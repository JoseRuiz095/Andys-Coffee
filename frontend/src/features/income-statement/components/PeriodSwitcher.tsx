export type ViewMode = 'day' | 'week' | 'month' | 'range';

interface PeriodSwitcherProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  date: string;
  onDateChange: (date: string) => void;
  month: string;
  onMonthChange: (month: string) => void;
  rangeFrom: string;
  rangeTo: string;
  onRangeFromChange: (date: string) => void;
  onRangeToChange: (date: string) => void;
}

const VIEW_MODES: Array<{ value: ViewMode; label: string }> = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'range', label: 'Rango personalizado' },
];

const inputStyle: React.CSSProperties = {
  borderColor: 'var(--color-border)',
  backgroundColor: 'var(--color-input-bg)',
  color: 'var(--color-input-text)',
};

export function PeriodSwitcher({
  viewMode,
  onViewModeChange,
  date,
  onDateChange,
  month,
  onMonthChange,
  rangeFrom,
  rangeTo,
  onRangeFromChange,
  onRangeToChange,
}: PeriodSwitcherProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-2">
        {VIEW_MODES.map((mode) => (
          <button
            key={mode.value}
            onClick={() => onViewModeChange(mode.value)}
            className="rounded-lg px-4 py-2 text-sm font-medium transition"
            style={{
              backgroundColor: viewMode === mode.value ? 'var(--color-primary)' : 'var(--color-surface)',
              color: viewMode === mode.value ? 'var(--color-button-text)' : 'var(--color-text-primary)',
              border: `1px solid ${viewMode === mode.value ? 'var(--color-primary)' : 'var(--color-border)'}`,
            }}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {(viewMode === 'day' || viewMode === 'week') && (
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
          style={inputStyle}
        />
      )}

      {viewMode === 'month' && (
        <input
          type="month"
          value={month}
          onChange={(e) => onMonthChange(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
          style={inputStyle}
        />
      )}

      {viewMode === 'range' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={rangeFrom}
            max={rangeTo || undefined}
            onChange={(e) => onRangeFromChange(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            a
          </span>
          <input
            type="date"
            value={rangeTo}
            min={rangeFrom || undefined}
            onChange={(e) => onRangeToChange(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
        </div>
      )}
    </div>
  );
}
