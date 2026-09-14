import { useLowStock } from '../hooks/useInventory';

export function InventoryAlerts() {
  const { data: lowStock, isLoading, error } = useLowStock();

  if (isLoading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-blue-800 text-sm">Cargando alertas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <p className="text-red-800 text-sm">Error cargando alertas</p>
      </div>
    );
  }

  if (!lowStock || lowStock.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <p className="text-green-800 text-sm">✓ Todo el inventario está en orden</p>
      </div>
    );
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
      <h3 className="text-yellow-900 font-semibold text-sm mb-3">
        ⚠ Ingredientes que requieren atención
      </h3>
      <div className="space-y-2">
        {lowStock.map((ingredient) => (
          <div key={ingredient.id} className="text-sm text-yellow-800">
            <p className="font-medium">
              {ingredient.name}
              {ingredient.sku && <span className="text-gray-600"> ({ingredient.sku})</span>}
            </p>
            <p className="text-yellow-700">
              {Number(ingredient.currentStock).toFixed(2)} {ingredient.unit.abbreviation} disponible
              {' '}
              (Mínimo: {Number(ingredient.minimumStock).toFixed(2)} {ingredient.unit.abbreviation})
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
