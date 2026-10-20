import { useState } from 'react'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'

const REASON_MAX_LENGTH = 500
const REQUIRED_REASON_MIN_LENGTH = 3

interface CancelOrderDialogProps {
  isOpen: boolean
  orderNumber: number | string | null
  isLoading?: boolean
  /**
   * 'cancel' cancels right away; 'request' asks an admin to approve cancelling a completed
   * sale (the reason is then required); 'approve-own' is an approver cancelling a completed
   * sale themselves (also with a required reason, kept in the request).
   */
  mode?: 'cancel' | 'request' | 'approve-own'
  /** Receives the trimmed reason, or undefined when left empty. */
  onConfirm: (reason: string | undefined) => void
  onCancel: () => void
}

const COPY = {
  cancel: {
    title: 'Cancelar orden',
    message: (n: string) => `¿Seguro que deseas cancelar la orden #${n}? Se devolverá el cobro y no se puede deshacer.`,
    confirm: 'Cancelar orden',
  },
  request: {
    title: 'Solicitar cancelación',
    message: (n: string) => `La orden #${n} ya se entregó: un administrador debe aprobar su cancelación. Si la aprueba, se devolverá el cobro.`,
    confirm: 'Enviar solicitud',
  },
  'approve-own': {
    title: 'Cancelar venta completada',
    message: (n: string) => `La orden #${n} ya se entregó. Como administrador, la cancelación se aprueba al momento y se devolverá el cobro.`,
    confirm: 'Cancelar venta',
  },
} as const

/**
 * Confirmation before cancelling a sale: cancelling reverses cash and inventory and cannot be
 * undone, so it always asks first and records why (kept in the audit log / the request).
 */
export function CancelOrderDialog({ isOpen, orderNumber, isLoading = false, mode = 'cancel', onConfirm, onCancel }: CancelOrderDialogProps) {
  const [reason, setReason] = useState('')
  const copy = COPY[mode]
  const reasonRequired = mode !== 'cancel'
  const trimmed = reason.trim()
  const missingReason = reasonRequired && trimmed.length < REQUIRED_REASON_MIN_LENGTH

  const close = () => {
    setReason('')
    onCancel()
  }

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={copy.title}
      message={copy.message(String(orderNumber ?? ''))}
      confirmText={copy.confirm}
      cancelText="Volver"
      isDangerous
      isLoading={isLoading}
      confirmDisabled={missingReason}
      onConfirm={() => {
        if (missingReason) return
        onConfirm(trimmed ? trimmed : undefined)
      }}
      onCancel={close}
    >
      <label className="mt-4 block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
        {reasonRequired ? 'Motivo' : 'Motivo (opcional)'}
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={REASON_MAX_LENGTH}
          rows={3}
          disabled={isLoading}
          placeholder="Ej. el cliente devolvió el pedido"
          className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-input-bg)',
            color: 'var(--color-text-primary)',
          }}
        />
      </label>
      {missingReason && (
        <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Escribe el motivo para continuar.
        </p>
      )}
    </ConfirmDialog>
  )
}
