import React from 'react'
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import { Button } from '../../../shared/components/Button'
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
        <div className="space-y-4 py-4">
          <ExtrasPicker extras={product.extras ?? []} value={extras} onChange={setExtras} />
          <div className="flex items-center justify-between rounded-xl border px-4 py-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-hover)' }}>
            <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>Precio total</span>
            <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--color-primary)' }}>{formatCurrency(total)}</span>
          </div>
        </div>
        <DialogFooter sticky>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => {
              onAddToOrder?.(product, 1, extras)
              onClose()
            }}
          >
            Agregar al pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
