import { StatusBadge } from '../../../shared/components/StatusBadge';
import type { InventoryIngredient } from '../api/inventory.api';
import { formatCurrency } from '../../../shared/utils/formatCurrency'

interface InventoryTableProps {
  ingredients: InventoryIngredient[];
  isLoading: boolean;
  /** Message when the (filtered) list is empty. */
  emptyMessage?: string;
}

type StockTone = 'danger' | 'warning' | 'success'

function getInventoryStatus(currentStock: number | string, minimumStock: number | string): StockTone {
  const current = Number(currentStock);
  const minimum = Number(minimumStock);

  if (current <= 0) return 'danger';
  if (current <= minimum) return 'warning';
  return 'success';
}

/** Below zero: sold beyond the recorded stock (decision D-1); a physical count fixes it. */
const isNegative = (currentStock: number | string) => Number(currentStock) < 0;

const STATUS_LABEL: Record<StockTone, string> = { danger: 'Agotado', warning: 'Bajo', success: 'Normal' };

const formatQuantity = (value: number | string) => Number(value).toFixed(2)

/**
 * Stock of the ingredients: name (SKU below), stock, minimum, unit cost, value and status. The
 * margin against the minimum is in the status tooltip; the inventory total lives in the summary
 * strip (it is not the sum of this page).
 */
export function InventoryTable({ ingredients, isLoading, emptyMessage = 'No hay ingredientes para mostrar' }: InventoryTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border p-6" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded animate-pulse" style={{ backgroundColor: 'var(--color-border)' }} />
          ))}
        </div>
      </div>
    );
  }

  if (ingredients.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>{emptyMessage}</p>
      </div>
    );
  }

  const headerCell = 'px-4 py-3 font-semibold'

  return (
    <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: 'var(--color-surface-hover)', color: 'var(--color-text-primary)' }}>
            <tr>
              <th className={`${headerCell} text-left`}>Ingrediente</th>
              <th className={`${headerCell} text-right`}>Stock actual</th>
              <th className={`${headerCell} text-right`}>Mínimo</th>
              <th className={`${headerCell} hidden text-right lg:table-cell`}>Costo unit.</th>
              <th className={`${headerCell} text-right`}>Valor</th>
              <th className={`${headerCell} text-center`}>Estado</th>
            </tr>
          </thead>
          <tbody style={{ borderColor: 'var(--color-border)' }} className="divide-y">
            {ingredients.map((ingredient) => {
              const status = getInventoryStatus(ingredient.currentStock, ingredient.minimumStock);
              const inventoryValue = Math.max(0, Number(ingredient.currentStock)) * Number(ingredient.averageCost);
              const margin = Number(ingredient.currentStock) - Number(ingredient.minimumStock);
              const unit = ingredient.unit.abbreviation;

              return (
                <tr key={ingredient.id} className="transition-colors hover:bg-[var(--color-surface-hover)]">
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{ingredient.name}</div>
                    {ingredient.sku && <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{ingredient.sku}</div>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {formatQuantity(ingredient.currentStock)} <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{unit}</span>
                  </td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--color-text-secondary)' }}>
                    {formatQuantity(ingredient.minimumStock)} <span className="text-xs">{unit}</span>
                  </td>
                  <td className="hidden px-4 py-3 text-right lg:table-cell" style={{ color: 'var(--color-text-secondary)' }}>
                    {formatCurrency(Number(ingredient.averageCost))}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {formatCurrency(inventoryValue)}
                  </td>
                  <td
                    className="px-4 py-3 text-center"
                    title={`${margin >= 0 ? '+' : ''}${formatQuantity(margin)} ${unit} respecto al mínimo`}
                  >
                    <StatusBadge tone={status}>{isNegative(ingredient.currentStock) ? 'Negativo' : STATUS_LABEL[status]}</StatusBadge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
