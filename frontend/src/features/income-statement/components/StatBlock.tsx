import { formatCurrency } from '../../../shared/utils/formatCurrency';

interface StatBlockProps {
  label: string;
  value: number | null;
  emphasize?: boolean;
  tone?: 'default' | 'success' | 'danger';
}

export function StatBlock({ label, value, emphasize = false, tone = 'default' }: StatBlockProps) {
  const toneColor =
    tone === 'success' ? 'var(--color-success)' : tone === 'danger' ? 'var(--color-danger)' : 'var(--color-text-primary)';

  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <span
        className={emphasize ? 'text-sm font-semibold' : 'text-sm'}
        style={{ color: emphasize ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
      >
        {label}
      </span>
      <span className={emphasize ? 'text-lg font-bold' : 'text-sm font-semibold'} style={{ color: toneColor }}>
        {value === null ? '—' : formatCurrency(value)}
      </span>
    </div>
  );
}
