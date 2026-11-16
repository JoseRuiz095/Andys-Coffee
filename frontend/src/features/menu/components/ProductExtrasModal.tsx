import React from 'react'
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import { ExtrasPicker } from './ExtrasPicker'
import { extrasUnitPrice } from '../utils/extras'
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from '../../../components/ui/dialog'
import type { MenuItem, SelectedExtra } from '../types/menu.types'

interface ProductExtrasModalProps {
  product: MenuItem
  onClose: () => void
  onAddToOrder?: (product: MenuItem, quantity: number, extras?: SelectedExtra[]) => void
}

/** Extras for a product that isn't part of a family (e.g. a bagel with extra cheese). */
export function ProductExtrasModal({ product, onClose, onAddToOrder }: ProductExtrasModalProps) {
  const [extras, setExtras] = React.useState<SelectedExtra[]>([])
  const total = product.price + extrasUnitPrice(extras)

  return (
    <Dialog open={true} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-4">
          <ExtrasPicker extras={product.extras ?? []} value={extras} onChange={setExtras} />
          <div className="flex items-center justify-between rounded-xl border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-hover)' }}>
            <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>Precio total</span>
            <span className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>{formatCurrency(total)}</span>
          </div>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{ backgroundColor: 'var(--color-surface-hover)', color: 'var(--color-text-primary)' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onAddToOrder?.(product, 1, extras)
              onClose()
            }}
            className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-button-text)]"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Agregar al pedido
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
