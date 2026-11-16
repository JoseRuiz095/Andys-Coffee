import { ProductImage } from '../../../../shared/components/ProductImage'
import { StatusBadge } from '../../../../shared/components/StatusBadge'
import { TableSkeleton } from '../../../../shared/components/TableSkeleton'
import { RowActions, type RowAction } from '../../../../shared/components/RowActions'
import { formatCurrency } from '../../../../shared/utils/formatCurrency'
import type { Product } from '../../../products/types/product.types'

interface ProductsTableProps {
  products: Product[]
  isLoading: boolean
  hasFilters: boolean
  getCategoryName: (categoryId?: string) => string
  /** "Caliente", "Frío", "Ambas", "Sin definir" or null when the product is not a drink. */
  getTemperatureLabel: (product: Product) => string | null
  canUpdate: boolean
  canDelete: boolean
  togglingProductId: string | null
  deletingProductId: string | null
  onEdit: (product: Product) => void
  onToggleActive: (product: Product) => void
  onDelete: (productId: string) => void
}

/** Catalog of products: name (category and SKU below), temperature, price, cost, status, actions. */
export function ProductsTable({
  products,
  isLoading,
  hasFilters,
  getCategoryName,
  getTemperatureLabel,
  canUpdate,
  canDelete,
  togglingProductId,
  deletingProductId,
  onEdit,
  onToggleActive,
  onDelete,
}: ProductsTableProps) {
  if (isLoading) return <TableSkeleton rows={6} columns={6} />

  if (products.length === 0) {
    return (
      <p className="rounded-lg border p-8 text-center" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
        {hasFilters ? 'Ningún producto coincide con los filtros.' : 'Aún no hay productos registrados.'}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
      <table className="w-full text-sm">
        <thead style={{ backgroundColor: 'var(--color-surface-hover)', color: 'var(--color-text-primary)' }}>
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Producto</th>
            <th className="hidden px-4 py-3 text-left font-semibold lg:table-cell">Temperatura</th>
            <th className="px-4 py-3 text-right font-semibold">Precio</th>
            <th className="px-4 py-3 text-right font-semibold">Costo</th>
            <th className="px-4 py-3 text-center font-semibold">Estado</th>
            <th className="px-4 py-3 text-right font-semibold"><span className="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {products.map((product) => {
            const temperature = getTemperatureLabel(product)
            const actions: RowAction[] = []
            if (canUpdate) {
              actions.push({ label: 'Editar', ariaLabel: `Editar ${product.name}`, onClick: () => onEdit(product) })
              actions.push({
                label: togglingProductId === product.id ? 'Cambiando...' : product.isActive ? 'Desactivar' : 'Activar',
                ariaLabel: `${product.isActive ? 'Desactivar' : 'Activar'} ${product.name}`,
                onClick: () => onToggleActive(product),
                disabled: togglingProductId !== null,
              })
            }
            if (canDelete) {
              actions.push({
                label: deletingProductId === product.id ? 'Eliminando...' : 'Eliminar',
                ariaLabel: `Eliminar ${product.name}`,
                onClick: () => onDelete(product.id),
                disabled: deletingProductId !== null,
                danger: true,
              })
            }
            return (
              <tr key={product.id} className="transition-colors hover:bg-[var(--color-surface-hover)]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                      <ProductImage src={product.imageUrl} alt="" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{product.name}</div>
                      <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {getCategoryName(product.categoryId)} · {product.sku}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="hidden px-4 py-3 lg:table-cell" style={{ color: 'var(--color-text-secondary)' }}>{temperature ?? '—'}</td>
                <td className="px-4 py-3 text-right font-medium" style={{ color: 'var(--color-text-primary)' }}>{formatCurrency(product.price)}</td>
                <td className="px-4 py-3 text-right" style={{ color: 'var(--color-text-secondary)' }}>{formatCurrency(product.cost)}</td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge tone={product.isActive ? 'success' : 'neutral'}>{product.isActive ? 'Activo' : 'Inactivo'}</StatusBadge>
                </td>
                <td className="px-4 py-3">
                  <RowActions actions={actions} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
