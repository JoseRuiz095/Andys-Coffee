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
  tax?: number
  total?: number
  isLoading?: boolean
  orderNotes?: string
  onClearOrder?: () => void
  onRemoveItem?: (itemId: string) => void
  onUpdateItemNote?: (itemId: string, note: string) => void
  onProcessTransaction?: () => void
  onNotesChange?: (notes: string) => void
  onCustomerNameChange?: (name: string) => void
}

export function OrderDetailsPanel({
  customerName,
  items,
  subtotal = 0,
  tax = 0,
  total = 0,
  isLoading = true,
  orderNotes,
  onRemoveItem,
  onUpdateItemNote,
  onProcessTransaction,
  onNotesChange,
  onCustomerNameChange,
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
        <div className="rounded-[1.5rem] border border-[#E7E3DC] bg-[#FDFBF7] p-4 shadow-[0_20px_50px_rgba(45,33,29,0.06)]">
          <Skeleton className="mb-3 h-5 w-32" />
          <Skeleton className="mb-4 h-8 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>

        {/* Order Details */}
        <div className="rounded-[1.5rem] border border-[#E7E3DC] bg-[#FDFBF7] p-4 shadow-[0_20px_50px_rgba(45,33,29,0.06)]">
          <Skeleton className="mb-4 h-5 w-28" />

          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3 rounded-xl bg-[#F2EFE8] p-3">
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
        <div className="rounded-[1.5rem] border border-[#E7E3DC] bg-[#FDFBF7] p-4 shadow-[0_20px_50px_rgba(45,33,29,0.06)]">
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
            <div className="my-2 border-t border-[#E7E3DC]" />
            <div className="flex justify-between">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>

          <Skeleton className="mt-4 h-10 w-full rounded-xl bg-[#5A804F]" />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Customer Info */}
        <div className="rounded-[1.5rem] border border-[#E7E3DC] bg-[#FDFBF7] p-4 shadow-[0_20px_50px_rgba(45,33,29,0.06)]">
          <h3 className="mb-3 font-semibold text-[#2C211D]">
            Información del cliente
          </h3>
          <input
            type="text"
            placeholder="Nombre del cliente"
            value={customerName || ''}
            onChange={(e) => onCustomerNameChange?.(e.target.value)}
            className="mb-3 w-full rounded-xl border border-[#E7E3DC] bg-white px-3 py-2 text-[#2C211D] placeholder-[#9CA3AF]"
          />
          <textarea
            placeholder="Notas de la orden..."
            value={orderNotes || ''}
            onChange={(e) => onNotesChange?.(e.target.value)}
            className="mb-3 w-full rounded-xl border border-[#E7E3DC] bg-white px-3 py-2 text-[#2C211D] placeholder-[#9CA3AF]"
            rows={3}
          />
          <select className="w-full rounded-xl border border-[#E7E3DC] bg-white px-3 py-2 text-[#4B5563]">
            <option>Seleccionar pago</option>
            <option>Efectivo</option>
            <option>Trasferencia</option>
          </select>
        </div>

        {/* Order Details */}
        <div className="rounded-[1.5rem] border border-[#E7E3DC] bg-[#FDFBF7] p-4 shadow-[0_20px_50px_rgba(45,33,29,0.06)]">
          <h3 className="mb-4 font-semibold text-[#2C211D]">
            Detalle de la orden
          </h3>

          {items && items.length > 0 ? (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-xl bg-[#F2EFE8] p-3"
                >
                  <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-[#D9E3D6]">
                    <img
                      src={getSupabaseImageUrl(item.image, 'Img', 'public')}
                      alt={item.productName}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#2C211D]">
                        {item.productName}
                      </span>
                      <button
                        onClick={() => handleOpenNoteModal(item)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                    </div>
                    {item.note && (
                      <p className="text-xs text-gray-500">Nota: {item.note}</p>
                    )}
                    <div className="text-xs text-[#6B7280]">
                      {item.quantity} × ${item.unitPrice.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-[#2C211D]">
                    ${(item.quantity * item.unitPrice).toFixed(2)}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onRemoveItem?.(item.id)}
                      className="p-1 text-red-500 hover:text-red-700"
                    >
                      <XIcon size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-[#6B7280]">
              Aún no hay productos agregados
            </div>
          )}
        </div>

        {/* Order Summary */}
        <div className="rounded-[1.5rem] border border-[#E7E3DC] bg-[#FDFBF7] p-4 shadow-[0_20px_50px_rgba(45,33,29,0.06)]">
          <h3 className="mb-4 font-semibold text-[#2C211D]">Resumen</h3>

          <div className="space-y-2">
            <div className="flex justify-between text-sm text-[#4B5563]">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-[#4B5563]">
              <span>Impuestos (10%)</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="my-3 border-t border-[#E7E3DC]" />
            <div className="flex justify-between text-base font-semibold text-[#2C211D]">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={onProcessTransaction}
            className="mt-4 w-full rounded-xl bg-[#5A804F] px-4 py-3 font-medium text-white transition-colors hover:bg-[#486B3E] disabled:opacity-50"
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
            className="my-4 w-full rounded-xl border border-[#E7E3DC] bg-white px-3 py-2 text-[#2C211D] placeholder-[#9CA3AF]"
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
