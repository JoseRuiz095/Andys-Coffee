import { StatusBadge } from '../../../shared/components/StatusBadge';
import type { InventoryIngredient } from '../api/inventory.api';

interface InventoryTableProps {
  ingredients: InventoryIngredient[];
  isLoading: boolean;
  onIngredientClick?: (id: string) => void;
}

function getInventoryStatus(
  currentStock: number | string,
  minimumStock: number | string,
): 'danger' | 'warning' | 'success' {
  const current = Number(currentStock);
  const minimum = Number(minimumStock);

  if (current <= 0) return 'danger';
  if (current <= minimum) return 'warning';
  return 'success';
}

function getStatusLabel(status: 'danger' | 'warning' | 'success'): string {
  switch (status) {
    case 'danger':
      return 'Agotado';
    case 'warning':
      return 'Bajo';
    case 'success':
      return 'Normal';
  }
}

function getStatusEmoji(status: 'danger' | 'warning' | 'success'): string {
  switch (status) {
    case 'danger':
      return '🔴';
    case 'warning':
      return '🟡';
    case 'success':
      return '🟢';
  }
}

export function InventoryTable({ ingredients, isLoading, onIngredientClick }: InventoryTableProps) {
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
        <p style={{ color: 'var(--color-text-secondary)' }}>No hay ingredientes para mostrar</p>
      </div>
    );
  }

  const totalInventoryValue = ingredients.reduce(
    (sum, ing) => sum + (Number(ing.currentStock) * Number(ing.averageCost)),
    0
  );

  return (
    <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0" style={{ backgroundColor: 'var(--color-surface-hover)', borderBottomColor: 'var(--color-border)', borderBottomWidth: '1px' }}>
            <tr>
              <th className="px-6 py-3 text-left font-semibold" style={{ color: 'var(--color-text-primary)' }}>SKU</th>
              <th className="px-6 py-3 text-left font-semibold" style={{ color: 'var(--color-text-primary)' }}>Ingrediente</th>
              <th className="px-6 py-3 text-right font-semibold" style={{ color: 'var(--color-text-primary)' }}>Stock Actual</th>
              <th className="px-6 py-3 text-right font-semibold" style={{ color: 'var(--color-text-primary)' }}>Mínimo</th>
              <th className="px-6 py-3 text-center font-semibold" style={{ color: 'var(--color-text-primary)' }}>Variación</th>
              <th className="px-6 py-3 text-right font-semibold" style={{ color: 'var(--color-text-primary)' }}>Costo Unit.</th>
              <th className="px-6 py-3 text-right font-semibold" style={{ color: 'var(--color-text-primary)' }}>Valor Total</th>
              <th className="px-6 py-3 text-center font-semibold" style={{ color: 'var(--color-text-primary)' }}>Estado</th>
            </tr>
          </thead>
          <tbody style={{ borderColor: 'var(--color-border)' }} className="divide-y">
            {ingredients.map((ingredient) => {
              const status = getInventoryStatus(
                ingredient.currentStock,
                ingredient.minimumStock,
              );
              const inventoryValue = (
                Number(ingredient.currentStock) * Number(ingredient.averageCost)
              ).toFixed(2);
              const variation = Number(ingredient.currentStock) - Number(ingredient.minimumStock);

              return (
                <tr
                  key={ingredient.id}
                  className="cursor-pointer transition-colors"
                  style={{
                    backgroundColor: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                  onClick={() => onIngredientClick?.(ingredient.id)}
                >
                  <td className="px-6 py-4 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {ingredient.sku || '—'}
                  </td>
                  <td className="px-6 py-4 font-medium" style={{ color: 'var(--color-text-primary)' }}>{ingredient.name}</td>
                  <td className="px-6 py-4 text-right" style={{ color: 'var(--color-text-secondary)' }}>
                    {Number(ingredient.currentStock).toFixed(2)}{' '}
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{ingredient.unit.abbreviation}</span>
                  </td>
                  <td className="px-6 py-4 text-right" style={{ color: 'var(--color-text-secondary)' }}>
                    {Number(ingredient.minimumStock).toFixed(2)}{' '}
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{ingredient.unit.abbreviation}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm font-medium" style={{ color: variation < 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                      {variation >= 0 ? '+' : ''}{variation.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right" style={{ color: 'var(--color-text-secondary)' }}>
                    ${Number(ingredient.averageCost).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    ${inventoryValue}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <StatusBadge tone={status}>
                      {getStatusEmoji(status)} {getStatusLabel(status)}
                    </StatusBadge>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="font-semibold" style={{ backgroundColor: 'var(--color-surface-hover)', borderTop: '2px solid var(--color-border)' }}>
            <tr>
              <td colSpan={6} className="px-6 py-4 text-right" style={{ color: 'var(--color-text-primary)' }}>
                Valor Total del Inventario:
              </td>
              <td className="px-6 py-4 text-right text-lg" style={{ color: 'var(--color-text-primary)' }}>
                ${totalInventoryValue.toFixed(2)}
              </td>
              <td className="px-6 py-4 text-center" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
