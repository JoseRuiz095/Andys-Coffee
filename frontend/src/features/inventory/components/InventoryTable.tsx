import type { InventoryIngredient } from '../api/inventory.api';

interface InventoryTableProps {
  ingredients: InventoryIngredient[];
  isLoading: boolean;
  onIngredientClick?: (id: string) => void;
}

function getInventoryStatus(
  currentStock: number | string,
  minimumStock: number | string,
): 'AGOTADO' | 'STOCK_BAJO' | 'NORMAL' {
  const current = Number(currentStock);
  const minimum = Number(minimumStock);

  if (current <= 0) return 'AGOTADO';
  if (current <= minimum) return 'STOCK_BAJO';
  return 'NORMAL';
}

function getStatusColor(status: 'AGOTADO' | 'STOCK_BAJO' | 'NORMAL'): string {
  switch (status) {
    case 'AGOTADO':
      return 'text-red-600 bg-red-50';
    case 'STOCK_BAJO':
      return 'text-yellow-600 bg-yellow-50';
    case 'NORMAL':
      return 'text-green-600 bg-green-50';
  }
}

export function InventoryTable({ ingredients, isLoading, onIngredientClick }: InventoryTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (ingredients.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No hay ingredientes para mostrar</p>
      </div>
    );
  }

  const totalInventoryValue = ingredients.reduce(
    (sum, ing) => sum + (Number(ing.currentStock) * Number(ing.averageCost)),
    0
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
            <tr>
              <th className="px-6 py-3 text-left font-semibold text-gray-900">SKU</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Ingrediente</th>
              <th className="px-6 py-3 text-right font-semibold text-gray-900">Stock Actual</th>
              <th className="px-6 py-3 text-right font-semibold text-gray-900">Mínimo</th>
              <th className="px-6 py-3 text-center font-semibold text-gray-900">Variación</th>
              <th className="px-6 py-3 text-right font-semibold text-gray-900">Costo Unit.</th>
              <th className="px-6 py-3 text-right font-semibold text-gray-900">Valor Total</th>
              <th className="px-6 py-3 text-center font-semibold text-gray-900">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {ingredients.map((ingredient) => {
              const status = getInventoryStatus(
                ingredient.currentStock,
                ingredient.minimumStock,
              );
              const statusColor = getStatusColor(status);
              const inventoryValue = (
                Number(ingredient.currentStock) * Number(ingredient.averageCost)
              ).toFixed(2);
              const variation = Number(ingredient.currentStock) - Number(ingredient.minimumStock);
              const variationColor = variation < 0 ? 'text-red-600 font-semibold' : 'text-green-600';

              return (
                <tr
                  key={ingredient.id}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                    status === 'AGOTADO' ? 'bg-red-50' : status === 'STOCK_BAJO' ? 'bg-yellow-50' : ''
                  }`}
                  onClick={() => onIngredientClick?.(ingredient.id)}
                >
                  <td className="px-6 py-4 text-gray-900 font-medium">
                    {ingredient.sku || '—'}
                  </td>
                  <td className="px-6 py-4 text-gray-900 font-medium">{ingredient.name}</td>
                  <td className="px-6 py-4 text-right text-gray-600">
                    {Number(ingredient.currentStock).toFixed(2)}{' '}
                    <span className="text-gray-500 text-xs">{ingredient.unit.abbreviation}</span>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600">
                    {Number(ingredient.minimumStock).toFixed(2)}{' '}
                    <span className="text-gray-500 text-xs">{ingredient.unit.abbreviation}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`${variationColor} text-sm font-medium`}>
                      {variation >= 0 ? '+' : ''}{variation.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600">
                    ${Number(ingredient.averageCost).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-900 font-semibold">
                    ${inventoryValue}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                      {status === 'AGOTADO' && '🔴'}
                      {status === 'STOCK_BAJO' && '🟡'}
                      {status === 'NORMAL' && '🟢'}
                      {' '}
                      <span className="text-xs">
                        {status === 'AGOTADO' && 'Agotado'}
                        {status === 'STOCK_BAJO' && 'Bajo'}
                        {status === 'NORMAL' && 'Normal'}
                      </span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 border-t-2 border-gray-300 font-semibold">
            <tr>
              <td colSpan={6} className="px-6 py-4 text-right text-gray-900">
                Valor Total del Inventario:
              </td>
              <td className="px-6 py-4 text-right text-gray-900 text-lg">
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
