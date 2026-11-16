import { useRef, useState } from 'react'
import { useCashSessionHistory, useCorrectCashClosing, useReopenCashSession, type CashSession } from '../hooks/useCashSessions'
import { cashDifferenceReasons } from '../constants'
import { QueryErrorState } from '../../../shared/components/QueryErrorState'
import { PageHeader } from '../../../shared/components/PageHeader'
import { FilterBar } from '../../../shared/components/FilterBar'
import { Pagination } from '../../../shared/components/Pagination'
import { RowActions } from '../../../shared/components/RowActions'
import { TableSkeleton } from '../../../shared/components/TableSkeleton'
import { StatusBadge } from '../../../shared/components/StatusBadge'
import { Modal } from '../../../shared/components/Modal'
import { Button } from '../../../shared/components/Button'
import { Input } from '../../../shared/components/Input'
import { Select } from '../../../shared/components/Select'
import { FormField } from '../../../shared/components/FormField'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { FILTER_FIELD_CLASS } from '../../../shared/constants/fieldStyles'
import { parseNonNegativeAmount } from '../../../shared/utils/numbers'
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import { formatDayAndTime } from '../../../shared/utils/dateUtils'

// Must match AUTO_CLOSE_REASON in backend/src/config/app.ts.
const AUTO_CLOSE_REASON = 'Cierre automático sin conteo'
const PAGE_SIZE = 20
const REOPEN_REASON_MAX = 120

const amount = (value: number | string | undefined | null) => parseFloat(String(value ?? 0))

/**
 * Closed cash cuts (paginated on the server). With cash.correct a cut can be corrected, and the
 * most recent one reopened while no drawer is open.
 */
export function CashSessionHistory({ canCorrect }: { canCorrect: boolean }) {
  const [page, setPage] = useState(1)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const { data, isLoading, isError, error, refetch, isFetching } = useCashSessionHistory({
    status: 'closed',
    page,
    limit: PAGE_SIZE,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  })
  // The backend reopens any closed cut; reopening only the latest one, and only while no drawer
  // is open, keeps a single open session and the cuts' order consistent.
  const latestClosed = useCashSessionHistory({ status: 'closed', page: 1, limit: 1 })
  const openSessions = useCashSessionHistory({ status: 'open', page: 1, limit: 1 })
  const latestClosedId = latestClosed.data?.data[0]?.id
  const hasOpenSession = (openSessions.data?.pagination.total ?? 0) > 0

  const [correcting, setCorrecting] = useState<CashSession | null>(null)
  const [reopening, setReopening] = useState<CashSession | null>(null)

  const hasFilters = startDate !== '' || endDate !== ''
  const sessions = data?.data ?? []

  return (
    <div>
      <PageHeader title="Cortes de caja" description="Cierres de caja con su monto esperado, contado y la diferencia." />

      <FilterBar
        hasFilters={hasFilters}
        onClear={() => {
          setStartDate('')
          setEndDate('')
          setPage(1)
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          Desde
          <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1) }} className={FILTER_FIELD_CLASS} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          Hasta
          <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1) }} className={FILTER_FIELD_CLASS} />
        </label>
      </FilterBar>

      {isLoading ? (
        <TableSkeleton rows={5} columns={5} />
      ) : isError ? (
        <QueryErrorState error={error} subject="los cortes de caja" onRetry={() => void refetch()} isRetrying={isFetching} />
      ) : sessions.length === 0 ? (
        <div className="rounded-xl border px-4 py-8 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
          {hasFilters ? 'No hay cortes en esas fechas.' : 'No hay cierres de caja registrados.'}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
            <table className="w-full text-sm" style={{ backgroundColor: 'var(--color-surface)' }}>
              <thead style={{ color: 'var(--color-text-secondary)' }}>
                <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <th className="px-4 py-3 text-left font-semibold">Cierre</th>
                  <th className="px-4 py-3 text-right font-semibold">Esperado</th>
                  <th className="px-4 py-3 text-right font-semibold">Contado</th>
                  <th className="px-4 py-3 text-right font-semibold">Diferencia</th>
                  {canCorrect && <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>}
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const expected = amount(session.expectedAmount)
                  const closing = amount(session.closingAmount)
                  const difference = closing - expected
                  // Closed by the end-of-day job: the "counted" amount is just the expected one.
                  const isUncounted = session.closingReason === AUTO_CLOSE_REASON
                  const canReopen = session.id === latestClosedId && !hasOpenSession

                  return (
                    <tr key={session.id} className="border-t transition-colors hover:bg-[var(--color-surface-hover)]" style={{ borderColor: 'var(--color-border)' }}>
                      <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>
                        {session.closedAt ? formatDayAndTime(session.closedAt) : '—'}
                        {session.closedBy?.name && (
                          <span className="block" style={{ color: 'var(--color-text-secondary)' }}>
                            {session.closedBy.name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right" style={{ color: 'var(--color-text-primary)' }}>{formatCurrency(expected)}</td>
                      <td className="px-4 py-3 text-right" style={{ color: 'var(--color-text-primary)' }}>{formatCurrency(closing)}</td>
                      <td className="px-4 py-3 text-right">
                        {isUncounted ? (
                          <StatusBadge tone="warning">Sin conteo</StatusBadge>
                        ) : (
                          <span style={{ color: difference < 0 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>{formatCurrency(difference)}</span>
                        )}
                      </td>
                      {canCorrect && (
                        <td className="px-4 py-3">
                          <RowActions
                            actions={[
                              { label: 'Corregir', ariaLabel: `Corregir el corte de ${formatCurrency(closing)}`, onClick: () => setCorrecting(session) },
                              ...(canReopen ? [{ label: 'Reabrir', ariaLabel: 'Reabrir la caja de este corte', onClick: () => setReopening(session) }] : []),
                            ]}
                          />
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {data?.pagination && (
            <Pagination
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              total={data.pagination.total}
              pageSize={data.pagination.limit}
              itemLabel="cortes"
              onPageChange={setPage}
              disabled={isFetching}
              className="mt-4"
            />
          )}
          {canCorrect && hasOpenSession && (
            <p className="mt-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Hay una caja abierta: para reabrir el último corte, ciérrala primero.
            </p>
          )}
        </>
      )}

      {correcting && <CorrectClosingDialog key={correcting.id} session={correcting} onClose={() => setCorrecting(null)} />}
      {reopening && <ReopenSessionDialog key={reopening.id} session={reopening} onClose={() => setReopening(null)} />}
    </div>
  )
}

function CorrectClosingDialog({ session, onClose }: { session: CashSession; onClose: () => void }) {
  const { mutate: correctClosing, isPending } = useCorrectCashClosing()
  const previous = amount(session.closingAmount)
  const amountRef = useRef<HTMLInputElement>(null)
  const [correctionAmount, setCorrectionAmount] = useState(String(previous))
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')
  const [errors, setErrors] = useState<{ amount?: string; reason?: string }>({})
  // A money correction is confirmed with the previous and the new amount side by side.
  const [pending, setPending] = useState<number | null>(null)

  const review = (e: React.FormEvent) => {
    e.preventDefault()
    const corrected = parseNonNegativeAmount(correctionAmount)
    const next = {
      amount: corrected === null ? 'Ingresa un monto válido (mayor o igual a 0).' : undefined,
      reason: reason ? undefined : 'Selecciona el motivo de la corrección.',
    }
    setErrors(next)
    if (corrected === null || !reason) return
    setPending(corrected)
  }

  const confirm = () => {
    if (pending === null || isPending) return
    correctClosing(
      { sessionId: session.id, correctedAmount: pending, reason, comment: comment.trim() || undefined },
      { onSuccess: onClose },
    )
  }

  return (
    <>
      <Modal isOpen onClose={onClose} ariaLabelledBy="correct-closing-title" initialFocusRef={amountRef}>
        <form onSubmit={review} noValidate className="space-y-4 p-6">
          <div>
            <h2 id="correct-closing-title" className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Corregir corte
            </h2>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {session.closedAt ? formatDayAndTime(session.closedAt) : ''} · Esperado {formatCurrency(amount(session.expectedAmount))} · Contado {formatCurrency(previous)}
            </p>
          </div>
          <FormField htmlFor="correct-amount" label="Monto contado correcto" required error={errors.amount}>
            <Input ref={amountRef} id="correct-amount" type="number" min={0} step="0.01" value={correctionAmount} onChange={(e) => setCorrectionAmount(e.target.value)} />
          </FormField>
          <FormField htmlFor="correct-reason" label="Motivo" required error={errors.reason}>
            <Select id="correct-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Selecciona un motivo</option>
              {cashDifferenceReasons.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
          </FormField>
          <FormField htmlFor="correct-comment" label="Comentario">
            <textarea
              id="correct-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="w-full rounded-md border px-4 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
            />
          </FormField>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1" disabled={isPending}>Cancelar</Button>
            <Button type="submit" variant="primary" className="flex-1" disabled={isPending}>Guardar</Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        isOpen={pending !== null}
        title="Confirmar corrección del corte"
        message={pending !== null ? `Monto contado: ${formatCurrency(previous)} → ${formatCurrency(pending)}. Motivo: ${reason}.` : ''}
        confirmText="Corregir"
        isLoading={isPending}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </>
  )
}

function ReopenSessionDialog({ session, onClose }: { session: CashSession; onClose: () => void }) {
  const { mutate: reopen, isPending } = useReopenCashSession()
  const reasonRef = useRef<HTMLTextAreaElement>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isPending) return
    if (!reason.trim()) {
      setError('Escribe el motivo: queda en la auditoría.')
      return
    }
    reopen({ sessionId: session.id, reason: reason.trim() }, { onSuccess: onClose })
  }

  return (
    <Modal isOpen onClose={onClose} ariaLabelledBy="reopen-session-title" initialFocusRef={reasonRef}>
      <form onSubmit={submit} noValidate className="space-y-4 p-6">
        <div>
          <h2 id="reopen-session-title" className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Reabrir caja
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Se descarta el conteo de {formatCurrency(amount(session.closingAmount))} y la caja vuelve a quedar abierta para seguir vendiendo.
            El conteo anterior queda guardado en la auditoría y se notificará la reapertura.
          </p>
        </div>
        <FormField htmlFor="reopen-reason" label="Motivo" required error={error} hint={`Máximo ${REOPEN_REASON_MAX} caracteres.`}>
          <textarea
            ref={reasonRef}
            id="reopen-reason"
            value={reason}
            maxLength={REOPEN_REASON_MAX}
            onChange={(e) => {
              setReason(e.target.value)
              setError(null)
            }}
            rows={2}
            className="w-full rounded-md border px-4 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
          />
        </FormField>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1" disabled={isPending}>Cancelar</Button>
          <Button type="submit" variant="primary" className="flex-1" disabled={isPending}>
            {isPending ? 'Reabriendo...' : 'Reabrir caja'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
