import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from '../../../components/ui/dialog'
import { PencilIcon } from '../../../components/ui/PencilIcon'
import { XIcon } from '../../../components/ui/XIcon'
import { Button } from '../../../shared/components/Button'
import { Skeleton } from '../../../shared/components/Skeleton'
import type { OrderItem } from '../types/order.types'
import { formatDrinkTemperature, getDrinkDisplayName } from '../../../shared/utils/productTemperature'

type DeliveryResponsible = 'customer_to_courier' | 'customer_to_business' | 'business_absorbs'
type DeliveryPaymentMethod = 'cash' | 'transfer'
type PaymentMethod = 'cash' | 'transfer' | 'card' | 'pending'

interface OrderDetailsPanelProps {
  customerName?: string
  items?: OrderItem[]
  subtotal?: number
  total?: number
  isLoading?: boolean
  orderNotes?: string
  paymentMethod?: PaymentMethod
  hasDelivery?: boolean
  deliveryAmount?: string
  deliveryResponsible?: DeliveryResponsible
  deliveryPaymentMethod?: DeliveryPaymentMethod
  scheduledFor?: string | null
  onClearOrder?: () => void
  onRemoveItem?: (itemId: string) => void
  onUpdateItemNote?: (itemId: string, note: string) => void
  onProcessTransaction?: () => void
  onScheduleOrder?: () => void
  onNotesChange?: (notes: string) => void
  onCustomerNameChange?: (name: string) => void
  onPaymentMethodChange?: (method: PaymentMethod) => void
  onHasDeliveryChange?: (value: boolean) => void
  onDeliveryAmountChange?: (value: string) => void
  onDeliveryResponsibleChange?: (value: DeliveryResponsible) => void
  onDeliveryPaymentMethodChange?: (value: DeliveryPaymentMethod) => void
}

export function OrderDetailsPanel({
  customerName,
  items,
  subtotal = 0,
  total = 0,
  isLoading = true,
  orderNotes,
  paymentMethod,
  hasDelivery = false,
  deliveryAmount = '',
  deliveryResponsible,
  deliveryPaymentMethod,
  scheduledFor,
  onRemoveItem,
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
      <div className="space-y-4">
        {/* Customer Info */}
        <div className="rounded-[1.5rem] border p-4 shadow-[0_20px_50px_rgba(45,33,29,0.06)]" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <Skeleton className="mb-3 h-5 w-32" />
          <Skeleton className="mb-4 h-8 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>

        {/* Order Details */}
        <div className="rounded-[1.5rem] border p-4 shadow-[0_20px_50px_rgba(45,33,29,0.06)]" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <Skeleton className="mb-4 h-5 w-28" />

          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3 rounded-xl p-3" style={{ backgroundColor: 'var(--color-surface-hover)' }}>
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="mb-1 h-3 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-5 w-12" />
              </div>
            ))}
          </div>
        </div>

        {/* Order Summary */}
        <div className="rounded-[1.5rem] border p-4 shadow-[0_20px_50px_rgba(45,33,29,0.06)]" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <Skeleton className="mb-4 h-5 w-28" />

          <div className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="my-2 border-t" style={{ borderColor: 'var(--color-border)' }} />
            <div className="flex justify-between">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>

          <Skeleton className="mt-4 h-10 w-full rounded-xl" style={{ backgroundColor: 'var(--color-primary)' }} />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Customer Info */}
        <div className="rounded-[1.5rem] border p-4 shadow-[0_20px_50px_rgba(45,33,29,0.06)]" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <h3 className="mb-3 font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Información del cliente
          </h3>
          <input
            type="text"
            placeholder="Nombre del cliente"
            value={customerName || ''}
            onChange={(e) => onCustomerNameChange?.(e.target.value)}
            className="mb-3 w-full rounded-xl border px-3 py-2"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-input-bg)',
              color: 'var(--color-text-primary)'
            }}
          />
          <textarea
            placeholder="Notas de la orden..."
            value={orderNotes || ''}
            onChange={(e) => onNotesChange?.(e.target.value)}
            className="mb-3 w-full rounded-xl border px-3 py-2"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-input-bg)',
              color: 'var(--color-text-primary)'
            }}
            rows={3}
          />
          <select
            value={paymentMethod || ''}
            onChange={(e) => onPaymentMethodChange?.(e.target.value as PaymentMethod)}
            className="w-full rounded-xl border px-3 py-2"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-input-bg)',
              color: 'var(--color-text-primary)'
            }}
          >
            <option value="" disabled>
              Seleccionar pago
            </option>
            <option value="cash">Efectivo</option>
            <option value="transfer">Transferencia</option>
            <option value="card">Tarjeta</option>
            <option value="pending">Pago Pendiente</option>
          </select>

          {/* Mandadito (delivery) */}
          <label className="mt-3 flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            <input
              type="checkbox"
              checked={hasDelivery}
              onChange={(e) => onHasDeliveryChange?.(e.target.checked)}
            />
            ¿Mandadito?
          </label>

          {hasDelivery && (
            <div className="mt-3 space-y-3 rounded-xl border p-3" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  Costo del mandadito
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="$0.00"
                  value={deliveryAmount}
                  onChange={(e) => onDeliveryAmountChange?.(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'var(--color-input-bg)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  ¿Quién recibe/paga el mandadito?
                </p>
                <div className="space-y-1">
                  <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                    <input
                      type="radio"
                      name="deliveryResponsible"
                      checked={deliveryResponsible === 'customer_to_courier'}
                      onChange={() => onDeliveryResponsibleChange?.('customer_to_courier')}
                    />
                    Cliente paga directamente al repartidor
                  </label>
                  <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                    <input
                      type="radio"
                      name="deliveryResponsible"
                      checked={deliveryResponsible === 'customer_to_business'}
                      onChange={() => onDeliveryResponsibleChange?.('customer_to_business')}
                    />
                    Cliente paga el mandadito a Andy's
                  </label>
                  <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                    <input
                      type="radio"
                      name="deliveryResponsible"
                      checked={deliveryResponsible === 'business_absorbs'}
                      onChange={() => onDeliveryResponsibleChange?.('business_absorbs')}
                    />
                    Andy's absorbe el mandadito
                  </label>
                </div>
              </div>

              {deliveryResponsible === 'customer_to_business' && (
                <div>
                  <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                    Método de pago del mandadito
                  </p>
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                      <input
                        type="radio"
                        name="deliveryPaymentMethod"
                        checked={deliveryPaymentMethod === 'cash'}
                        onChange={() => onDeliveryPaymentMethodChange?.('cash')}
                      />
                      Efectivo
                    </label>
                    <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                      <input
                        type="radio"
                        name="deliveryPaymentMethod"
                        checked={deliveryPaymentMethod === 'transfer'}
                        onChange={() => onDeliveryPaymentMethodChange?.('transfer')}
                      />
                      Transferencia
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Order Details */}
        <div className="rounded-[1.5rem] border p-4 shadow-[0_20px_50px_rgba(45,33,29,0.06)]" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <h3 className="mb-4 font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Detalle de la orden
          </h3>

          {items && items.length > 0 ? (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-xl p-3"
                  style={{ backgroundColor: 'var(--color-surface-hover)' }}
                >
                  <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg" style={{ backgroundColor: 'var(--color-surface-secondary)' }}>
                    <img
                      src={item.image}
                      alt={item.productName}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {getDrinkDisplayName(item.productName, item.temperature)}
                      </span>
                      {item.temperature && (
                        <span className="rounded px-1.5 py-0.5 text-xs" style={{ backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-text-primary)' }}>
                          {formatDrinkTemperature(item.temperature)}
                        </span>
                      )}
                      <button
                        onClick={() => handleOpenNoteModal(item)}
                        className="p-1 transition-colors"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                    </div>
                    {item.note && (
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Nota: {item.note}</p>
                    )}
                    <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {item.quantity} × ${item.unitPrice.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    ${(item.quantity * item.unitPrice).toFixed(2)}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onRemoveItem?.(item.id)}
                      className="p-1 transition-colors"
                      style={{ color: 'var(--color-danger)' }}
                    >
                      <XIcon size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Aún no hay productos agregados
            </div>
          )}
        </div>

        {/* Order Summary */}
        <div className="rounded-[1.5rem] border p-4 shadow-[0_20px_50px_rgba(45,33,29,0.06)]" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
          <h3 className="mb-4 font-semibold" style={{ color: 'var(--color-text-primary)' }}>Resumen</h3>

          <div className="space-y-2">
            <div className="flex justify-between text-sm" style={{ color: 'var(--color-ghost-text)' }}>
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="my-3 border-t" style={{ borderColor: 'var(--color-border)' }} />
            <div className="flex justify-between text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={onScheduleOrder}
              className="rounded-xl px-4 py-3 font-medium transition-colors disabled:opacity-50"
              style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
              disabled={isLoading || !items || items.length === 0}
            >
              {scheduledFor ? 'Reprogramar' : 'Programar pedido'}
            </button>
            <button
              onClick={onProcessTransaction}
              className="rounded-xl px-4 py-3 font-medium text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
              disabled={isLoading || !items || items.length === 0}
            >
              {isLoading ? 'Procesando...' : 'Procesar orden'}
            </button>
          </div>
          {scheduledFor && (
            <div className="mt-3 rounded-xl border p-2 text-xs" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)' }}>
              Programado para: {new Date(scheduledFor).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          )}
        </div>
      </div>
      <Dialog open={!!editingItem} onOpenChange={(isOpen: boolean) => !isOpen && handleCloseNoteModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir nota para {editingItem?.productName}</DialogTitle>
          </DialogHeader>
          <textarea
            placeholder="Escriba una nota para el producto..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="my-4 w-full rounded-xl border px-3 py-2"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-input-bg)',
              color: 'var(--color-text-primary)'
            }}
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
