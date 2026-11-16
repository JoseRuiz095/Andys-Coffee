import { PencilIcon } from '../../../components/ui/PencilIcon'
import { XIcon } from '../../../components/ui/XIcon'
import { ProductImage } from '../../../shared/components/ProductImage'
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import { formatDrinkTemperature, getDrinkDisplayName } from '../../../shared/utils/productTemperature'
import { extrasUnitPrice } from '../../menu/utils/extras'
import type { OrderItem } from '../types/order.types'

interface OrderCartLineProps {
  item: OrderItem
  /** Server amounts of the line, when the quote is in. */
  line?: { gross: number; net: number }
  isProcessing?: boolean
  onRemove?: (itemId: string) => void
  onIncrement?: (itemId: string) => void
  onDelete?: (itemId: string) => void
  onEditNote?: (item: OrderItem) => void
}

// 40px controls (44px on touch screens): comfortable for a finger on a tablet.
const controlClassName =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-primary)_45%,transparent)] disabled:opacity-40 pointer-coarse:h-11 pointer-coarse:w-11'

/** One line of the order: what it is, how much it costs and the controls to change it. */
export function OrderCartLine({ item, line, isProcessing = false, onRemove, onIncrement, onDelete, onEditNote }: OrderCartLineProps) {
  const unitPrice = item.unitPrice + extrasUnitPrice(item.extras)
  const lineAmount = line ? line.net : item.quantity * unitPrice
  const hasLineDiscount = line ? line.gross > line.net : false

  return (
    <li className="flex gap-3 py-2.5">
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg" style={{ backgroundColor: 'var(--color-image-tile)' }}>
        <ProductImage src={item.image} alt={item.productName} fit="contain" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-[0.9375rem] font-semibold leading-5" style={{ color: 'var(--color-text-primary)' }}>
            {getDrinkDisplayName(item.productName, item.temperature)}
            {item.temperature && (
              <span
                className="ml-1.5 inline-block rounded px-1.5 align-[1px] text-xs font-medium"
                style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 14%, var(--color-surface))', color: 'var(--color-text-primary)' }}
              >
                {formatDrinkTemperature(item.temperature)}
              </span>
            )}
          </p>
          <div className="shrink-0 text-right text-sm font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
            {hasLineDiscount && line && (
              <div className="text-xs font-normal line-through" style={{ color: 'var(--color-text-secondary)' }}>
                {formatCurrency(line.gross)}
              </div>
            )}
            {formatCurrency(lineAmount)}
          </div>
        </div>
        {item.extras && item.extras.length > 0 && (
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {item.extras.map((extra) => `+ ${extra.name}${extra.quantity > 1 ? ` ×${extra.quantity}` : ''}`).join(', ')}
            {item.quantity > 1 ? ' (c/u)' : ''}
          </p>
        )}
        {item.note && (
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Nota: {item.note}</p>
        )}
        {/* text-lg reaches the − / + buttons by inheritance (index.css `button { font: inherit }`). */}
        <div className="mt-1.5 flex items-center gap-1.5 text-lg">
          <button
            type="button"
            onClick={() => onRemove?.(item.id)}
            disabled={isProcessing}
            aria-label={`Quitar una unidad de ${item.productName}`}
            className={controlClassName}
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            −
          </button>
          <span className="w-7 text-center text-base font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
            {item.quantity}
          </span>
          <button
            type="button"
            onClick={() => onIncrement?.(item.id)}
            disabled={isProcessing || item.quantity >= 99}
            aria-label={`Agregar una unidad de ${item.productName}`}
            className={controlClassName}
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            +
          </button>
          {item.quantity > 1 && (
            <span className="ml-1 hidden min-w-0 truncate text-xs tabular-nums @[22rem]:inline" style={{ color: 'var(--color-text-secondary)' }}>
              {formatCurrency(unitPrice)} c/u
            </span>
          )}
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => onEditNote?.(item)}
            disabled={isProcessing}
            aria-label={`Nota para ${item.productName}`}
            title="Nota"
            className={controlClassName}
            style={{ borderColor: 'transparent', color: item.note ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(item.id)}
            disabled={isProcessing}
            aria-label={`Eliminar ${item.productName} de la orden`}
            title="Eliminar línea"
            className={controlClassName}
            style={{ borderColor: 'color-mix(in srgb, var(--color-danger) 35%, var(--color-surface))', color: 'var(--color-danger)' }}
          >
            <XIcon size={16} />
          </button>
        </div>
      </div>
    </li>
  )
}
