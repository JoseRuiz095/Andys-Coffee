import { useInventorySummary } from '../hooks/useInventory';

export function InventoryStats() {
  const { data: summary, isLoading, error } = useInventorySummary();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-lg p-4 animate-pulse"
          >
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <p className="text-red-800 text-sm">Error cargando estadísticas</p>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* Total Ingredientes */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-gray-600 text-sm font-medium mb-2">Total de Ingredientes</p>
        <p className="text-2xl font-bold text-gray-900">{summary.totalIngredients}</p>
      </div>

      {/* Stock Bajo */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-gray-600 text-sm font-medium mb-2">Stock Bajo</p>
        <p className="text-2xl font-bold text-yellow-600">{summary.lowStockCount}</p>
      </div>

      {/* Agotados */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-gray-600 text-sm font-medium mb-2">Agotados</p>
        <p className="text-2xl font-bold text-red-600">{summary.outOfStockCount}</p>
      </div>

      {/* Valor Total */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-gray-600 text-sm font-medium mb-2">Valor Total</p>
        <p className="text-2xl font-bold text-green-600">
          ${parseFloat(summary.totalValue).toFixed(2)}
        </p>
      </div>
    </div>
  );
}
