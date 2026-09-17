import { EXPENSE_CATEGORIES } from '../types/expense.types';
import type { ExpenseCategory } from '../types/expense.types';

interface ExpenseFiltersProps {
  category?: ExpenseCategory | '';
  startDate?: string;
  endDate?: string;
  onCategoryChange: (category: ExpenseCategory | '') => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onClear: () => void;
}

export function ExpenseFilters({
  category = '',
  startDate = '',
  endDate = '',
  onCategoryChange,
  onStartDateChange,
  onEndDateChange,
  onClear,
}: ExpenseFiltersProps) {
  const hasActiveFilters = category || startDate || endDate;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Categoría
          </label>
          <select
            value={category || ''}
            onChange={(e) => onCategoryChange(e.target.value as ExpenseCategory | '')}
            className="w-full px-3 py-2 border rounded-lg"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
          >
            <option value="">Todas</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Desde
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Hasta
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
          />
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--color-text-secondary)' }} className="text-sm">
            Filtros activos:
          </span>
          <div className="flex flex-wrap gap-2">
            {category && (
              <span
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-button-text)' }}
              >
                {category}
              </span>
            )}
            {startDate && (
              <span
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-button-text)' }}
              >
                Desde {new Date(startDate).toLocaleDateString('es-ES')}
              </span>
            )}
            {endDate && (
              <span
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-button-text)' }}
              >
                Hasta {new Date(endDate).toLocaleDateString('es-ES')}
              </span>
            )}
          </div>
          <button
            onClick={onClear}
            className="ml-auto px-3 py-1 text-xs rounded hover:opacity-80"
            style={{ backgroundColor: 'var(--color-surface-secondary)', color: 'var(--color-text-primary)' }}
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
}
