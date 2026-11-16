import { useState } from 'react'
import { Button } from '../../../shared/components/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog'
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import { cashInputValue, quickCashAmounts } from '../utils/quickCash'

interface CashPaymentDialogProps {
  open: boolean
  /** Sale amount paid in cash (0 if the sale is paid otherwise); null while it is being priced. */
  saleAmount: number | null
  /** Mandadito paid to Andy's in cash, charged in the same handover. */
  deliveryAmount?: number
  isLoading?: boolean
  /** Why the server total could not be obtained; cash is never charged without it. */
  pricingError?: string | null
  isRetryingPricing?: boolean
  onRetryPricing?: () => void
  onClose: () => void
  onConfirm: (cashReceived: number) => void
}

// Keys and quick amounts: 48px tall (52px on touch screens) for fast tapping on a tablet. Their
// font comes from the group (index.css `button { font: inherit }` overrides font utilities).
const keyClassName =
  'min-h-12 rounded-lg border tabular-nums transition-colors active:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-primary)_45%,transparent)] disabled:opacity-50 pointer-coarse:min-h-13'

export function CashPaymentDialog({
  open,
  saleAmount,
  deliveryAmount = 0,
  isLoading = false,
  pricingError = null,
  isRetryingPricing = false,
  onRetryPricing,
  onClose,
  onConfirm,
}: CashPaymentDialogProps) {
  const [cashReceived, setCashReceived] = useState('')

  const isPricing = saleAmount === null
  const total = (saleAmount ?? 0) + deliveryAmount
  const received = Number(cashReceived)
  const change = Number.isFinite(received) ? received - total : 0
  const canConfirm = !isPricing && (cashReceived !== '' || total === 0) && Number.isFinite(received) && received >= total
  const quickAmounts = isPricing ? [] : quickCashAmounts(total)

  const appendDigit = (digit: string) => {
    setCashReceived((current) => (current === '0' ? digit : `${current}${digit}`))
  }

  const clearAmount = () => setCashReceived('')

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()} size="xl">
      <DialogContent>
        <DialogHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--color-primary)' }}>Pago en efectivo</p>
          <DialogTitle>Calcula el cambio</DialogTitle>
        </DialogHeader>
        {/* Amounts on the left, keypad on the right: fits a tablet in landscape without scrolling. */}
        <div className="grid gap-4 py-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1 rounded-xl p-3" style={{ backgroundColor: 'var(--color-background)' }}>
              {deliveryAmount > 0 && (
                <>
                  <div className="flex justify-between text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <span>Venta</span>
                    <span className="tabular-nums">{isPricing ? 'Calculando…' : formatCurrency((saleAmount ?? 0))}</span>
                  </div>
                  <div className="flex justify-between text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <span>Mandadito</span>
                    <span className="tabular-nums">{formatCurrency(deliveryAmount)}</span>
                  </div>
                </>
              )}
              <div className="flex items-end justify-between gap-2">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Total a cobrar en efectivo</span>
                <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                  {isPricing ? 'Calculando…' : formatCurrency(total)}
                </span>
              </div>
            </div>
            <label className="block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Monto recibido
              <div className="mt-1.5 flex items-center rounded-xl border px-4 focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--color-primary)_15%,transparent)]" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)' }}>
                <span style={{ color: 'var(--color-primary)' }}>$</span>
                <input
                  autoFocus
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={cashReceived}
                  onChange={(event) => setCashReceived(event.target.value)}
                  className="min-h-12 w-full bg-transparent px-3 tabular-nums outline-none"
                  style={{ color: 'var(--color-input-text)', fontSize: '1.25rem', fontWeight: 600 }}
                  aria-label="Monto recibido"
                  disabled={isLoading}
                />
              </div>
            </label>
            <div role="group" aria-label="Montos rápidos" className="grid grid-cols-3 gap-2 text-sm font-semibold">
              <button
                type="button"
                onClick={() => setCashReceived(cashInputValue(total))}
                disabled={isLoading || isPricing}
                className={keyClassName}
                style={{ borderColor: 'var(--color-primary)', backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, var(--color-surface))', color: 'var(--color-text-primary)' }}
              >
                Exacto
              </button>
              {quickAmounts.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setCashReceived(String(amount))}
                  disabled={isLoading}
                  className={keyClassName}
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
                >
                  {formatCurrency(amount)}
                </button>
              ))}
            </div>
            <div className="rounded-xl border p-3" style={{ borderColor: canConfirm ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: canConfirm ? 'var(--color-surface)' : 'var(--color-background)' }}>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Cambio</span>
                <span className="text-2xl font-bold tabular-nums" style={{ color: canConfirm ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>
                  {formatCurrency(Math.max(0, change))}
                </span>
              </div>
              {!canConfirm && !(isPricing && pricingError) && (
                <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {isPricing ? 'Esperando el total del servidor…' : 'El monto recibido debe cubrir el total.'}
                </p>
              )}
              {isPricing && pricingError && (
                <div role="alert" className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: 'var(--color-danger)' }}>
                  <span>{pricingError} No se puede cobrar en efectivo sin el total del servidor.</span>
                  {onRetryPricing && (
                    <Button variant="link" onClick={onRetryPricing} disabled={isRetryingPricing}>
                      {isRetryingPricing ? 'Reintentando…' : 'Reintentar'}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 content-start gap-2 text-lg font-semibold" role="group" aria-label="Teclado numérico">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '.'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => appendDigit(digit)}
                disabled={isLoading}
                className={keyClassName}
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={clearAmount}
              disabled={isLoading}
              className={keyClassName}
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)', color: 'var(--color-text-primary)' }}
            >
              <span className="text-sm">Limpiar</span>
            </button>
          </div>
        </div>
        <DialogFooter sticky>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancelar</Button>
          <Button onClick={() => onConfirm(received)} disabled={!canConfirm || isLoading}>
            {isLoading ? 'Procesando...' : 'Confirmar pago'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
