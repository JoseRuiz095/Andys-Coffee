import { useInventorySettings, useProductsWithoutRecipe } from '../hooks/useInventory'

interface ConsumptionOffNoticeProps {
  /** Opens Catálogo → Productos, where the missing recipes are captured. */
  onShowProducts: () => void
}

/**
 * Always visible while "Descontar inventario al vender" is off: sales then leave the stock
 * untouched, which looked like the inventory "not working" (audit 2026-11-17, A1/A4).
 */
export function ConsumptionOffNotice({ onShowProducts }: ConsumptionOffNoticeProps) {
  const { data: settings } = useInventorySettings()
  const { data: withoutRecipe = [] } = useProductsWithoutRecipe()
  if (!settings || settings.consumeOnSale) return null

  return (
    <section
      role="status"
      className="mb-5 rounded-lg border px-4 py-3 text-sm"
      style={{
        borderColor: 'color-mix(in srgb, var(--color-danger) 45%, var(--color-border))',
        backgroundColor: 'color-mix(in srgb, var(--color-danger) 8%, var(--color-surface))',
        color: 'var(--color-text-primary)',
      }}
    >
      <p className="font-semibold">El descuento automático está apagado: las ventas no descuentan insumos.</p>
      {withoutRecipe.length > 0 ? (
        <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Para activarlo, captura la receta de {withoutRecipe.length} producto(s) o márcalos como "No controla inventario"
          ({withoutRecipe.map((product) => product.name).join(', ')}).{' '}
          <button type="button" onClick={onShowProducts} className="font-medium hover:underline" style={{ color: 'var(--color-primary)' }}>
            Ir a Productos
          </button>
        </p>
      ) : (
        <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Todos los productos tienen receta: actívalo en "Ajustes del inventario".
        </p>
      )}
    </section>
  )
}
