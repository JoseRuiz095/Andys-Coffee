import { useInventorySummary } from '../hooks/useInventory';

export function InventoryStats() {
  const { data: summary, isLoading, error } = useInventorySummary();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-lg p-4 animate-pulse"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            <div className="h-4 rounded w-3/4 mb-2" style={{ backgroundColor: 'var(--color-border)' }}></div>
            <div className="h-6 rounded w-1/2" style={{ backgroundColor: 'var(--color-border)' }}></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg p-4 mb-6" style={{ backgroundColor: `color-mix(in srgb, var(--color-danger) 12%, var(--color-surface))`, border: '1px solid var(--color-danger)' }}>
        <p className="text-sm" style={{ color: 'var(--color-danger)' }}>Error cargando estadísticas</p>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* Total Ingredientes */}
      <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Total de Ingredientes</p>
        <p className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{summary.totalIngredients}</p>
      </div>

      {/* Stock Bajo */}
      <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Stock Bajo</p>
        <p className="text-2xl font-bold" style={{ color: 'var(--color-warning)' }}>{summary.lowStockCount}</p>
      </div>

      {/* Agotados */}
      <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Agotados</p>
        <p className="text-2xl font-bold" style={{ color: 'var(--color-danger)' }}>{summary.outOfStockCount}</p>
      </div>

      {/* Valor Total */}
      <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Valor Total</p>
        <p className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>
          ${parseFloat(summary.totalValue).toFixed(2)}
        </p>
      </div>
    </div>
  );
}
