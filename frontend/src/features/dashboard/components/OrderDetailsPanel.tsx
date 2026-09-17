import { useState } from 'react'
import { getSupabaseImageUrl } from '../../../shared/utils/imageUtils'
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

interface OrderDetailsPanelProps {
  customerName?: string
  items?: OrderItem[]
  subtotal?: number
  total?: number
  isLoading?: boolean
  orderNotes?: string
  paymentMethod?: string
  onClearOrder?: () => void
  onRemoveItem?: (itemId: string) => void
  onUpdateItemNote?: (itemId: string, note: string) => void
  onProcessTransaction?: () => void
  onNotesChange?: (notes: string) => void
  onCustomerNameChange?: (name: string) => void
  onPaymentMethodChange?: (method: string) => void
}

export function OrderDetailsPanel({
  customerName,
  items,
  subtotal = 0,
  total = 0,
  isLoading = true,
  orderNotes,
  paymentMethod,
  onRemoveItem,
  onUpdateItemNote,
  onProcessTransaction,
  onNotesChange,
  onCustomerNameChange,
  onPaymentMethodChange,
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
            onChange={(e) => onPaymentMethodChange?.(e.target.value)}
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
            <option value="Efectivo">Efectivo</option>
            <option value="Transferencia">Transferencia</option>
          </select>
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
                    {getSupabaseImageUrl(item.image, 'Img', 'public') && (
                      <img
                        src={getSupabaseImageUrl(item.image, 'Img', 'public')}
                        alt={item.productName}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {item.productName}
                      </span>
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

          <button
            onClick={onProcessTransaction}
            className="mt-4 w-full rounded-xl px-4 py-3 font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
            disabled={!items || items.length === 0}
          >
            Procesar orden
          </button>
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
