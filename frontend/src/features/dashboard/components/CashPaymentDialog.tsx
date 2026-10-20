import { useState } from 'react'
import { Button } from '../../../shared/components/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog'

interface CashPaymentDialogProps {
  open: boolean
  /** Sale amount paid in cash (0 if the sale is paid otherwise); null while it is being priced. */
  saleAmount: number | null
  /** Mandadito paid to Andy's in cash, charged in the same handover. */
  deliveryAmount?: number
  isLoading?: boolean
  onClose: () => void
  onConfirm: (cashReceived: number) => void
}

export function CashPaymentDialog({
  open,
  saleAmount,
  deliveryAmount = 0,
  isLoading = false,
  onClose,
  onConfirm,
}: CashPaymentDialogProps) {
  const [cashReceived, setCashReceived] = useState('')

  const isPricing = saleAmount === null
  const total = (saleAmount ?? 0) + deliveryAmount
  const received = Number(cashReceived)
  const change = Number.isFinite(received) ? received - total : 0
  const canConfirm = !isPricing && (cashReceived !== '' || total === 0) && Number.isFinite(received) && received >= total

  const appendDigit = (digit: string) => {
    setCashReceived((current) => (current === '0' ? digit : `${current}${digit}`))
  }

  const clearAmount = () => setCashReceived('')

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--color-primary)' }}>Pago en efectivo</p>
          <DialogTitle>Calcula el cambio</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 p-4 sm:p-6">
          <div className="space-y-2 rounded-xl p-4" style={{ backgroundColor: 'var(--color-background)' }}>
            {deliveryAmount > 0 && (
              <>
                <div className="flex justify-between text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  <span>Venta</span>
                  <span>{isPricing ? 'Calculando…' : `$${(saleAmount ?? 0).toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  <span>Mandadito</span>
                  <span>${deliveryAmount.toFixed(2)}</span>
                </div>
              </>
            )}
            <div className="flex items-end justify-between">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Total a cobrar en efectivo</span>
              <span className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {isPricing ? 'Calculando…' : `$${total.toFixed(2)}`}
              </span>
            </div>
          </div>
          <label className="block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Monto recibido
            <div className="mt-2 flex items-center rounded-xl border px-4 focus-within:ring-2 focus-within:ring-[#5A804F]/15" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)' }}>
              <span style={{ color: 'var(--color-primary)' }}>$</span>
              <input
                autoFocus
                type="number"
                min="0"
                step="0.01"
                value={cashReceived}
                onChange={(event) => setCashReceived(event.target.value)}
                className="min-h-12 w-full bg-transparent px-3 text-xl font-semibold outline-none"
                style={{ color: 'var(--color-input-text)' }}
                aria-label="Monto recibido"
                disabled={isLoading}
              />
            </div>
          </label>
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border)', backgroundColor: canConfirm ? 'var(--color-surface)' : 'var(--color-background)' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Cambio</span>
              <span className="text-2xl font-bold" style={{ color: canConfirm ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>
                ${Math.max(0, change).toFixed(2)}
              </span>
            </div>
            {!canConfirm && (
              <p className="mt-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {isPricing ? 'Esperando el total del servidor…' : 'El monto recibido debe cubrir el total.'}
              </p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '.'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => appendDigit(digit)}
                disabled={isLoading}
                className="min-h-10 rounded-lg border text-lg font-semibold transition"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={clearAmount}
              disabled={isLoading}
              className="min-h-10 rounded-lg border text-sm font-semibold"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text-primary)' }}
            >
              Limpiar
            </button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>Cancelar</Button>
          <Button onClick={() => onConfirm(received)} disabled={!canConfirm || isLoading}>
            {isLoading ? 'Procesando...' : 'Confirmar pago'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
