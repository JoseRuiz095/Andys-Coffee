import { useState } from 'react'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import type { PendingCancellationRequest } from '../types/orders.types'

interface CancellationRequestsPanelProps {
  requests: PendingCancellationRequest[]
  /** Request whose decision is being sent. */
  reviewingId: string | null
  onReview: (request: PendingCancellationRequest, decision: 'approve' | 'reject', comment: string | undefined) => void
}

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })

/** Approver's list of completed sales waiting for a cancellation decision. */
export function CancellationRequestsPanel({ requests, reviewingId, onReview }: CancellationRequestsPanelProps) {
  const [pending, setPending] = useState<{ request: PendingCancellationRequest; decision: 'approve' | 'reject' } | null>(null)
  const [comment, setComment] = useState('')

  if (requests.length === 0) return null

  const closeDialog = () => {
    setPending(null)
    setComment('')
  }

  return (
    <section
      className="rounded-2xl border p-4"
      style={{ borderColor: 'var(--color-warning)', backgroundColor: 'color-mix(in srgb, var(--color-warning) 8%, var(--color-surface))' }}
      aria-label="Cancelaciones por aprobar"
    >
      <h3 className="mb-3 font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        Cancelaciones por aprobar ({requests.length})
      </h3>
      <ul className="space-y-3">
        {requests.map((request) => (
          <li
            key={request.id}
            className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
          >
            <div className="min-w-0 text-sm">
              <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Orden #{request.order.orderNumber} · {formatCurrency(Number(request.order.total))}
                {request.order.customerName ? ` · ${request.order.customerName}` : ''}
              </p>
              <p style={{ color: 'var(--color-text-secondary)' }}>
                {request.requestedBy.name} · {formatDateTime(request.createdAt)}
              </p>
              <p className="mt-1" style={{ color: 'var(--color-text-primary)' }}>Motivo: {request.reason}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={reviewingId !== null}
                onClick={() => setPending({ request, decision: 'reject' })}
                className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              >
                Rechazar
              </button>
              <button
                type="button"
                disabled={reviewingId !== null}
                onClick={() => setPending({ request, decision: 'approve' })}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-danger)' }}
              >
                {reviewingId === request.id ? 'Procesando...' : 'Aprobar'}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        isOpen={Boolean(pending)}
        title={pending?.decision === 'approve' ? 'Aprobar cancelación' : 'Rechazar cancelación'}
        message={pending?.decision === 'approve'
          ? `La orden #${pending.request.order.orderNumber} se cancelará y se devolverá su cobro. No se puede deshacer.`
          : `La orden #${pending?.request.order.orderNumber ?? ''} seguirá completada.`}
        confirmText={pending?.decision === 'approve' ? 'Aprobar y cancelar' : 'Rechazar'}
        cancelText="Volver"
        isDangerous={pending?.decision === 'approve'}
        isLoading={pending !== null && reviewingId === pending.request.id}
        onConfirm={() => {
          if (!pending) return
          onReview(pending.request, pending.decision, comment.trim() || undefined)
          closeDialog()
        }}
        onCancel={closeDialog}
      >
        <label className="mt-4 block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          Comentario (opcional)
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={500}
            rows={2}
            className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-text-primary)' }}
          />
        </label>
      </ConfirmDialog>
    </section>
  )
}
