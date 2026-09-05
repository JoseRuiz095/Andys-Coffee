import { useEffect, useState } from 'react'
import { Button } from '../../../shared/components/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog'

interface CashPaymentDialogProps {
  open: boolean
  total: number
  isLoading?: boolean
  onClose: () => void
  onConfirm: (cashReceived: number) => void
}

export function CashPaymentDialog({
  open,
  total,
  isLoading = false,
  onClose,
  onConfirm,
}: CashPaymentDialogProps) {
  const [cashReceived, setCashReceived] = useState('')

  useEffect(() => {
    if (open) setCashReceived('')
  }, [open])

  const received = Number(cashReceived)
  const change = Number.isFinite(received) ? received - total : 0
  const canConfirm = Number.isFinite(received) && received >= total

  const appendDigit = (digit: string) => {
    setCashReceived((current) => (current === '0' ? digit : `${current}${digit}`))
  }

  const clearAmount = () => setCashReceived('')

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A6A45]">Pago en efectivo</p>
          <DialogTitle>Calcula el cambio</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 p-4 sm:p-6">
          <div className="flex items-end justify-between rounded-xl bg-[#F2EFE8] p-4">
            <span className="text-sm text-[#6B7280]">Total a cobrar</span>
            <span className="text-2xl font-bold text-[#2C211D]">${total.toFixed(2)}</span>
          </div>
          <label className="block text-sm font-medium text-[#2C211D]">
            Monto recibido
            <div className="mt-2 flex items-center rounded-xl border border-[#E7E3DC] bg-white px-4 focus-within:border-[#5A804F] focus-within:ring-2 focus-within:ring-[#5A804F]/15">
              <span className="text-[#8A6A45]">$</span>
              <input
                autoFocus
                type="number"
                min="0"
                step="0.01"
                value={cashReceived}
                onChange={(event) => setCashReceived(event.target.value)}
                className="min-h-12 w-full bg-transparent px-3 text-xl font-semibold text-[#2C211D] outline-none"
                aria-label="Monto recibido"
              />
            </div>
          </label>
          <div className={`rounded-xl border p-4 ${canConfirm ? 'border-[#D9E3D6] bg-[#EEF4EB]' : 'border-[#E7C7C2] bg-[#FFF7F5]'}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#6B7280]">Cambio</span>
              <span className={`text-2xl font-bold ${canConfirm ? 'text-[#486B3E]' : 'text-[#8D3B32]'}`}>
                ${Math.max(0, change).toFixed(2)}
              </span>
            </div>
            {!canConfirm && <p className="mt-2 text-xs text-[#8D3B32]">El monto recibido debe cubrir el total.</p>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '.'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => appendDigit(digit)}
                className="min-h-10 rounded-lg border border-[#E7E3DC] bg-white text-lg font-semibold text-[#2C211D] transition hover:bg-[#F2EFE8]"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={clearAmount}
              className="min-h-10 rounded-lg border border-[#E7C7C2] bg-[#FFF7F5] text-sm font-semibold text-[#8D3B32]"
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
