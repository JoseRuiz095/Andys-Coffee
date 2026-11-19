import { StatusBadge } from '../../../shared/components/StatusBadge';
import type { InventoryIngredient } from '../api/inventory.api';
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import { CELL_SECONDARY_CLASS, NUMERIC_CLASS, TABLE_CARD_CLASS, TABLE_CLASS, TABLE_HEAD_CLASS, TD_CLASS, TH_CLASS, TR_CLASS } from '../../../shared/constants/tableStyles'

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

  const headerCell = TH_CLASS

  return (
    <div className={TABLE_CARD_CLASS}>
      <div className="overflow-x-auto">
        <table className={TABLE_CLASS}>
          <thead className={TABLE_HEAD_CLASS}>
            <tr>
              <th className={`${headerCell} text-left`}>Ingrediente</th>
              <th className={`${headerCell} text-right`}>Stock actual</th>
              <th className={`${headerCell} text-right`}>Mínimo</th>
              <th className={`${headerCell} hidden text-right lg:table-cell`}>Costo unit.</th>
              <th className={`${headerCell} text-right`}>Valor</th>
              <th className={`${headerCell} text-center`}>Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {ingredients.map((ingredient) => {
              const status = getInventoryStatus(ingredient.currentStock, ingredient.minimumStock);
              const inventoryValue = Math.max(0, Number(ingredient.currentStock)) * Number(ingredient.averageCost);
              const margin = Number(ingredient.currentStock) - Number(ingredient.minimumStock);
              const unit = ingredient.unit.abbreviation;

              return (
                <tr key={ingredient.id} className={TR_CLASS}>
                  <td className={TD_CLASS}>
                    <div className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{ingredient.name}</div>
                    {ingredient.sku && <div className={CELL_SECONDARY_CLASS}>{ingredient.sku}</div>}
                  </td>
                  <td
                    className={`${TD_CLASS} ${NUMERIC_CLASS} font-semibold`}
                    style={{ color: isNegative(ingredient.currentStock) ? 'var(--color-danger)' : 'var(--color-text-primary)' }}
                  >
                    {formatQuantity(ingredient.currentStock)} <span className="font-normal" style={{ color: 'var(--color-text-secondary)' }}>{unit}</span>
                  </td>
                  <td className={`${TD_CLASS} ${NUMERIC_CLASS}`} style={{ color: 'var(--color-text-secondary)' }}>
                    {formatQuantity(ingredient.minimumStock)} {unit}
                  </td>
                  <td className={`${TD_CLASS} ${NUMERIC_CLASS} hidden lg:table-cell`} style={{ color: 'var(--color-text-secondary)' }}>
                    {formatCurrency(Number(ingredient.averageCost))}
                  </td>
                  <td className={`${TD_CLASS} ${NUMERIC_CLASS} font-semibold`} style={{ color: 'var(--color-text-primary)' }}>
                    {formatCurrency(inventoryValue)}
                  </td>
                  <td
                    className={`${TD_CLASS} text-center`}
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
