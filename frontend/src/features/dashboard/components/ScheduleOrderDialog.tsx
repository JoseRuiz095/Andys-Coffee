import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog'
import { formatShortDateTime } from '../../../shared/utils/dateUtils'

interface ScheduleOrderDialogProps {
  open: boolean
  /** `<input type="datetime-local">` value. */
  value: string
  onChange: (value: string) => void
  onCancel: () => void
  onConfirm: () => void
}

/** Picks when a scheduled order becomes active on the board. */
export function ScheduleOrderDialog({ open, value, onChange, onCancel, onConfirm }: ScheduleOrderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Programar pedido</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <label className="block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Fecha y hora programada
            <input
              type="datetime-local"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              className="mt-2 w-full rounded-xl border px-3 py-2"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-input-bg)',
                color: 'var(--color-text-primary)',
              }}
            />
          </label>
          <div className="rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)' }}>
            {value ? `Se activará el ${formatShortDateTime(value)}.` : 'Selecciona una fecha y hora futura.'}
          </div>
        </div>
        <DialogFooter>
          <button type="button" className="rounded-xl px-3 py-2 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }} onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-button-text)' }} onClick={onConfirm}>
            Confirmar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
