import { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from '../../../components/ui/dialog'
import { PencilIcon } from '../../../components/ui/PencilIcon'
import { Button } from '../../../shared/components/Button'
import { Skeleton } from '../../../shared/components/Skeleton'
import { usePrevious } from '../../../shared/hooks/usePrevious'
import type { OrderItem } from '../types/order.types'
import type { DeliveryResponsible, PosPaymentMethod } from '../utils/saleForm'
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import { formatShortDateTime } from '../../../shared/utils/dateUtils'
import { OrderCartLine } from './OrderCartLine'
import { PaymentMethodSelector } from './PaymentMethodSelector'
import { DeliveryOptions } from './DeliveryOptions'

type DeliveryPaymentMethod = 'cash' | 'transfer'

interface OrderDetailsPanelProps {
  customerName?: string
  items?: OrderItem[]
  subtotal?: number
  /** Promotion discount priced by the server. */
  discount?: number
  total?: number
  /** Server amounts per cart line (same order as `items`), when available. */
  lineTotals?: { gross: number; net: number }[]
  /** True while the server price of the current cart is on its way. */
  isPricing?: boolean
  pricingError?: string | null
  isRetryingPricing?: boolean
  onRetryPricing?: () => void
  /** Mandadito the customer pays to Andy's, charged on top of the sale (not revenue). */
  deliveryCharge?: number
  isLoading?: boolean
  /** The sale is being sent: the order stays visible but can't be edited or sent again. */
  isProcessing?: boolean
  orderNotes?: string
  paymentMethod?: PosPaymentMethod
  hasDelivery?: boolean
  deliveryAmount?: string
  deliveryResponsible?: DeliveryResponsible
  deliveryPaymentMethod?: DeliveryPaymentMethod
  scheduledFor?: string | null
  /** Takes one unit off the line (removes it at 1). */
  onRemoveItem?: (itemId: string) => void
  onIncrementItem?: (itemId: string) => void
  /** Removes the whole line. */
  onDeleteItem?: (itemId: string) => void
  onUpdateItemNote?: (itemId: string, note: string) => void
  onProcessTransaction?: () => void
  onScheduleOrder?: () => void
  onNotesChange?: (notes: string) => void
  onCustomerNameChange?: (name: string) => void
  onPaymentMethodChange?: (method: PosPaymentMethod) => void
  onHasDeliveryChange?: (value: boolean) => void
  onDeliveryAmountChange?: (value: string) => void
  onDeliveryResponsibleChange?: (value: DeliveryResponsible) => void
  onDeliveryPaymentMethodChange?: (value: DeliveryPaymentMethod) => void
}

// Typography of buttons and inputs is set on their container or on an inner span: index.css has
// an unlayered `button, input { font: inherit }` that overrides font utilities on the element.

const panelStyle = { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }

// Beside the menu the order fills the window height: the lines scroll and the total with the
// actions stays pinned at the bottom (`pos-fit`). On a very short window the whole panel
// scrolls, sticky beside the menu.
const panelClassName =
  '@container flex flex-col overflow-hidden rounded-[1.25rem] border shadow-[var(--shadow-card)] md:sticky md:top-3 md:max-h-[calc(100svh-1.5rem)] md:self-start md:overflow-y-auto pos-fit:static pos-fit:h-full pos-fit:max-h-none pos-fit:min-h-0 pos-fit:self-stretch pos-fit:overflow-hidden'

const inputClassName = 'w-full rounded-xl border px-3'
const inputStyle = {
  borderColor: 'var(--color-border)',
  backgroundColor: 'var(--color-input-bg)',
  color: 'var(--color-text-primary)',
}

// Toggle chips of the optional parts of the order (note, mandadito).
const chipClassName =
  'inline-flex min-h-10 items-center gap-2 rounded-full border px-3 transition-colors focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--color-primary)_45%,transparent)] pointer-coarse:min-h-11'
const chipStyle = (isOn: boolean) => ({
  borderColor: isOn ? 'var(--color-primary)' : 'var(--color-border)',
  backgroundColor: isOn ? 'color-mix(in srgb, var(--color-primary) 12%, var(--color-surface))' : 'var(--color-surface)',
  color: 'var(--color-text-primary)',
})

export function OrderDetailsPanel({
  customerName,
  items,
  subtotal = 0,
  discount = 0,
  total = 0,
  lineTotals,
  isPricing = false,
  pricingError = null,
  isRetryingPricing = false,
  onRetryPricing,
  deliveryCharge = 0,
  isLoading = false,
  isProcessing = false,
  orderNotes,
  paymentMethod,
  hasDelivery = false,
  deliveryAmount = '',
  deliveryResponsible,
  deliveryPaymentMethod,
  scheduledFor,
  onRemoveItem,
  onIncrementItem,
  onDeleteItem,
  onUpdateItemNote,
  onProcessTransaction,
  onScheduleOrder,
  onNotesChange,
  onCustomerNameChange,
  onPaymentMethodChange,
  onHasDeliveryChange,
  onDeliveryAmountChange,
  onDeliveryResponsibleChange,
  onDeliveryPaymentMethodChange,
}: OrderDetailsPanelProps) {
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null)
  const [note, setNote] = useState('')
  // The order note is optional: its field opens on demand (and stays open while it has text).
  const [isNotesOpen, setIsNotesOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const itemCount = items?.length ?? 0
  const unitCount = items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0
  const previousItemCount = usePrevious(itemCount)
  const showNotes = isNotesOpen || Boolean(orderNotes)
  const hasItems = itemCount > 0

  // A new line goes to the end of the list: bring it into view so the cashier sees it was added.
  useEffect(() => {
    if (previousItemCount === undefined || itemCount <= previousItemCount) return
    const scroller = scrollRef.current
    if (scroller && scroller.scrollHeight > scroller.clientHeight) {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' })
    }
  }, [itemCount, previousItemCount])

  const handleOpenNoteModal = (item: OrderItem) => {
    setEditingItem(item)
    setNote(item.note || '')
  }

  const handleCloseNoteModal = () => {
    setEditingItem(null)
    setNote('')
  }

  const handleSaveNote = () => {
    if (editingItem) {
      onUpdateItemNote?.(editingItem.id, note)
      handleCloseNoteModal()
    }
  }

  if (isLoading) {
    return (
      <div className={panelClassName} style={panelStyle} aria-busy="true">
        <div className="space-y-2 border-b p-3" style={{ borderColor: 'var(--color-border)' }}>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
        <div className="flex-1 space-y-3 p-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-8 w-28" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-2 border-t p-3" style={{ borderColor: 'var(--color-border)' }}>
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  const amountOrPricing = (amount: number) => (isPricing && !pricingError ? 'Calculando…' : formatCurrency(amount))

  return (
    <>
      <section aria-label="Orden actual" className={panelClassName} style={panelStyle}>
        <div ref={scrollRef} className="flex-1 overscroll-contain pos-fit:min-h-0 pos-fit:overflow-y-auto">
          {/* Who and how it is paid. */}
          <div className="space-y-2 border-b p-3 text-[0.9375rem]" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Orden actual</h2>
              {hasItems && (
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  {unitCount === 1 ? '1 producto' : `${unitCount} productos`}
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder={paymentMethod === 'pending' ? 'Nombre del cliente (obligatorio)' : 'Nombre del cliente'}
              aria-label="Nombre del cliente"
              aria-required={paymentMethod === 'pending'}
              value={customerName || ''}
              onChange={(e) => onCustomerNameChange?.(e.target.value)}
              className={`${inputClassName} min-h-10 pointer-coarse:min-h-11`}
              style={inputStyle}
            />
            <PaymentMethodSelector value={paymentMethod} onChange={onPaymentMethodChange} />
            <div className="flex flex-wrap gap-2 font-medium">
              <button
                type="button"
                aria-label="Nota de la orden"
                aria-expanded={showNotes}
                onClick={() => setIsNotesOpen((open) => !open || Boolean(orderNotes))}
                className={chipClassName}
                style={chipStyle(Boolean(orderNotes))}
              >
                <PencilIcon className="h-4 w-4" aria-hidden="true" />
                Nota
              </button>
              <label className={`${chipClassName} cursor-pointer`} style={chipStyle(hasDelivery)}>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--color-primary)]"
                  checked={hasDelivery}
                  onChange={(e) => onHasDeliveryChange?.(e.target.checked)}
                />
                ¿Mandadito?
              </label>
            </div>
            {showNotes && (
              <textarea
                placeholder="Notas de la orden..."
                aria-label="Notas de la orden"
                value={orderNotes || ''}
                onChange={(e) => onNotesChange?.(e.target.value)}
                className={`${inputClassName} py-2`}
                style={inputStyle}
                rows={2}
                autoFocus={isNotesOpen && !orderNotes}
              />
            )}
            {hasDelivery && (
              <DeliveryOptions
                amount={deliveryAmount}
                responsible={deliveryResponsible}
                paymentMethod={deliveryPaymentMethod}
                onAmountChange={onDeliveryAmountChange}
                onResponsibleChange={onDeliveryResponsibleChange}
                onPaymentMethodChange={onDeliveryPaymentMethodChange}
              />
            )}
          </div>

          {/* What is being sold. */}
          <div className="px-3">
            <h3 className="sr-only">Detalle de la orden</h3>
            {hasItems ? (
              <ul className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {items!.map((item, index) => (
                  <OrderCartLine
                    key={item.id}
                    item={item}
                    line={lineTotals?.length === items!.length ? lineTotals[index] : undefined}
                    isProcessing={isProcessing}
                    onRemove={onRemoveItem}
                    onIncrement={onIncrementItem}
                    onDelete={onDeleteItem}
                    onEditNote={handleOpenNoteModal}
                  />
                ))}
              </ul>
            ) : (
              <div className="py-8 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                <p>Aún no hay productos agregados</p>
                <p className="mt-1 text-xs">Toca un producto del menú para agregarlo.</p>
              </div>
            )}
          </div>
        </div>

        {/* Total and actions: always in view. */}
        <div
          className="shrink-0 space-y-1.5 border-t p-3"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'color-mix(in srgb, var(--color-surface-hover) 60%, var(--color-surface))' }}
        >
          <h3 className="sr-only">Resumen</h3>
          <div className="flex justify-between text-sm" style={{ color: 'var(--color-ghost-text)' }}>
            <span>Subtotal</span>
            <span className="tabular-nums">{formatCurrency(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm font-medium" style={{ color: 'var(--color-success-hover)' }}>
              <span>Promociones</span>
              <span className="tabular-nums">−{formatCurrency(discount)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <span className="text-sm font-semibold uppercase tracking-wide">Total</span>
            <span data-testid="pos-total" className="text-2xl font-bold tabular-nums">{amountOrPricing(total)}</span>
          </div>
          {deliveryCharge > 0 && (
            <>
              <div className="flex justify-between text-sm" style={{ color: 'var(--color-ghost-text)' }}>
                <span>Mandadito (aparte de la venta)</span>
                <span className="tabular-nums">{formatCurrency(deliveryCharge)}</span>
              </div>
              <div className="flex justify-between text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
                <span>Total con mandadito</span>
                <span className="tabular-nums">{amountOrPricing(total + deliveryCharge)}</span>
              </div>
            </>
          )}
          {pricingError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: 'var(--color-danger)' }}>
              <span>{pricingError} El total mostrado es aproximado; el servidor lo confirmará al procesar.</span>
              {onRetryPricing && (
                <Button variant="link" onClick={onRetryPricing} disabled={isRetryingPricing}>
                  {isRetryingPricing ? 'Reintentando…' : 'Reintentar'}
                </Button>
              )}
            </div>
          )}
          {scheduledFor && (
            <p className="rounded-lg px-2 py-1 text-xs font-medium" style={{ backgroundColor: 'color-mix(in srgb, var(--color-info) 12%, var(--color-surface))', color: 'var(--color-text-primary)' }}>
              Programado para: {formatShortDateTime(scheduledFor)}
            </p>
          )}

          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2 pt-1">
            <button
              type="button"
              onClick={onScheduleOrder}
              className="min-h-12 rounded-xl border px-2 transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-primary)_45%,transparent)] disabled:opacity-50"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
              disabled={isProcessing || !hasItems}
            >
              <span className="block text-sm font-semibold leading-tight">{scheduledFor ? 'Reprogramar' : 'Programar pedido'}</span>
            </button>
            <button
              type="button"
              onClick={onProcessTransaction}
              className="min-h-12 rounded-xl px-3 text-[var(--color-button-text)] shadow-sm transition-colors bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-50"
              disabled={isProcessing || !hasItems}
            >
              <span className="text-base font-bold">{isProcessing ? 'Procesando...' : 'Procesar orden'}</span>
            </button>
          </div>
        </div>
      </section>
      <Dialog open={!!editingItem} onOpenChange={(isOpen: boolean) => !isOpen && handleCloseNoteModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir nota para {editingItem?.productName}</DialogTitle>
          </DialogHeader>
          <textarea
            placeholder={editingItem && editingItem.quantity > 1 ? `Aplica a las ${editingItem.quantity} unidades. Ej. 1 deslactosado, 1 sin azúcar` : "Ej. deslactosado, sin azúcar"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="my-4 w-full rounded-xl border px-3 py-2"
            style={inputStyle}
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={handleCloseNoteModal}>Cancelar</Button>
            <Button onClick={handleSaveNote}>Guardar Nota</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
