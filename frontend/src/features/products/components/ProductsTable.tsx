import type { Product } from '../types/product.types'
import { hasPermission } from '../../auth/utils/permissions'
import type { AuthUser } from '../../auth/types/auth.types'

interface ProductsTableProps {
  products: Product[]
  loading?: boolean
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
  onToggleActive: (product: Product) => void
  currentUser: AuthUser | null
}

export function ProductsTable({
  products,
  loading,
  onEdit,
  onDelete,
  onToggleActive,
  currentUser,
}: ProductsTableProps) {
  const canEdit = hasPermission(currentUser, 'products.update')
  const canDelete = hasPermission(currentUser, 'products.delete')

  if (loading) {
    return <div className="text-center py-8">Cargando productos...</div>
  }

  if (products.length === 0) {
    return <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No hay productos</div>
  }

  return (
    <div className="overflow-x-auto rounded-xl border shadow-md" style={{ borderColor: 'var(--color-border)' }}>
      <table className="w-full text-sm">
        <thead style={{ backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
          <tr>
            <th className="p-4 text-left font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Nombre
            </th>
            <th className="p-4 text-left font-bold" style={{ color: 'var(--color-text-primary)' }}>
              SKU
            </th>
            <th className="p-4 text-right font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Precio
            </th>
            <th className="p-4 text-right font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Costo
            </th>
            <th className="p-4 text-center font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Activo
            </th>
            {(canEdit || canDelete) && (
              <th className="p-4 text-right font-bold" style={{ color: 'var(--color-text-primary)' }}>
                Acciones
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr
              key={product.id}
              className="transition-colors duration-150 hover:opacity-80"
              style={{
                borderBottom: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
              }}
            >
              <td className="p-4 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {product.name}
              </td>
              <td className="p-4" style={{ color: 'var(--color-text-secondary)' }}>
                {product.sku}
              </td>
              <td className="p-4 text-right" style={{ color: 'var(--color-text-primary)' }}>
                ${product.price.toFixed(2)}
              </td>
              <td className="p-4 text-right" style={{ color: 'var(--color-text-primary)' }}>
                ${product.cost.toFixed(2)}
              </td>
              <td className="p-4 text-center">
                <input
                  type="checkbox"
                  checked={product.isActive}
                  onChange={() => onToggleActive(product)}
                  disabled={!canEdit}
                  className="cursor-pointer"
                />
              </td>
              {(canEdit || canDelete) && (
                <td className="p-4 text-right space-x-2 flex justify-end gap-2">
                  {canEdit && (
                    <button
                      onClick={() => onEdit(product)}
                      className="px-3 py-1 text-xs font-semibold rounded text-white transition-colors duration-200 focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: 'var(--color-primary)',
                        '--tw-ring-color': 'var(--color-primary)'
                      } as React.CSSProperties}
                      aria-label={`Editar producto ${product.name}`}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
                    >
                      Editar
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => onDelete(product)}
                      className="px-3 py-1 text-xs font-semibold rounded text-white transition-colors duration-200 focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: 'var(--color-danger)',
                        '--tw-ring-color': 'var(--color-danger)'
                      } as React.CSSProperties}
                      aria-label={`Eliminar producto ${product.name}`}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-danger-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-danger)'}
                    >
                      Eliminar
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
