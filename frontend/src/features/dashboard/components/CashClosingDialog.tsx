import { useState } from 'react'
import { Button } from '../../../shared/components/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog'
import { cashDifferenceReasons } from '../constants'
import { formatCurrency } from '../../../shared/utils/formatCurrency'

interface CashClosingDialogProps {
  open: boolean
  expectedAmount: number
  isLoading?: boolean
  onClose: () => void
  onConfirm: (input: { closingAmount: number; reason?: string; comment?: string }) => void
}

export function CashClosingDialog({ open, expectedAmount, isLoading = false, onClose, onConfirm }: CashClosingDialogProps) {
  const [step, setStep] = useState<'count' | 'review'>('count')
  const [closingAmount, setClosingAmount] = useState('')
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')

  // An empty field is "not counted yet", never $0 (Number('') would be 0).
  const hasCount = closingAmount.trim() !== ''
  const counted = hasCount ? Number(closingAmount) : Number.NaN
  const isValidCount = Number.isFinite(counted) && counted >= 0
  const difference = isValidCount ? counted - expectedAmount : 0
  const hasDifference = Math.abs(difference) >= 0.005
  const canContinue = isValidCount && (!hasDifference || reason.length > 0)

  return (
    // The cashier can always back out (Escape, backdrop, Cancelar/Regresar) until the close is sent.
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && !isLoading && onClose()}>
      <DialogContent>
        <DialogHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--color-primary)' }}>Corte de caja</p>
          <DialogTitle>{step === 'count' ? 'Cuenta el efectivo disponible' : 'Resumen del corte'}</DialogTitle>
        </DialogHeader>
        {step === 'count' ? (
          <div className="space-y-5 p-4 sm:p-6">
            <p className="text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>Cuenta físicamente todo el efectivo y registra el monto contado.</p>
            <label className="block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Efectivo contado
              <div className="mt-2 flex items-center rounded-xl border px-4 focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--color-primary)_15%,transparent)]" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)' }}>
                <span style={{ color: 'var(--color-primary)' }}>$</span>
                <input autoFocus type="number" min="0" step="0.01" value={closingAmount} onChange={(event) => setClosingAmount(event.target.value)} className="min-h-12 w-full bg-transparent px-3 text-xl font-semibold outline-none" style={{ color: 'var(--color-input-text)' }} />
              </div>
            </label>
            <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-text-secondary)' }}>
              El monto contado se registrará y ya no podrá editarse después de continuar. Solo un usuario autorizado podrá corregirlo.
            </div>
          </div>
        ) : (
          <div className="space-y-5 p-4 sm:p-6">
            <div className="space-y-3 rounded-xl p-4 text-sm" style={{ backgroundColor: 'var(--color-background)' }}>
              <div className="flex justify-between"><span>Contado</span><strong>{formatCurrency(counted)}</strong></div>
              <div className="flex justify-between"><span>Esperado</span><strong>{formatCurrency(expectedAmount)}</strong></div>
              <div className="border-t pt-3 flex justify-between" style={{ borderColor: 'var(--color-border)' }}><span>Diferencia</span><strong style={{ color: difference < 0 ? 'var(--color-text-secondary)' : 'var(--color-primary)' }}>{formatCurrency(difference)}</strong></div>
            </div>
            {hasDifference && (
              <>
                <label className="block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Motivo
                  <select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border px-3 text-sm" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}>
                    <option value="">Selecciona un motivo</option>
                    {cashDifferenceReasons.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Comentario
                  <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }} placeholder="Describe la diferencia" />
                </label>
              </>
            )}
          </div>
        )}
        <DialogFooter>
          {step === 'count' ? (
            <Button variant="ghost" onClick={onClose} disabled={isLoading}>Cancelar</Button>
          ) : (
            // Back to the count with the typed amount kept, to fix a typo before confirming.
            <Button variant="ghost" onClick={() => setStep('count')} disabled={isLoading}>Regresar</Button>
          )}
          {step === 'count' ? (
            <Button onClick={() => setStep('review')} disabled={!isValidCount}>Continuar</Button>
          ) : (
            <Button onClick={() => onConfirm({ closingAmount: counted, reason: reason || undefined, comment: comment || undefined })} disabled={!canContinue || isLoading}>
              {isLoading ? 'Cerrando...' : 'Confirmar cierre'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
