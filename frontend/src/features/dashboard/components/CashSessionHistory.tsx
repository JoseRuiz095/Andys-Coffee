import { useState } from 'react'
import { useCashSessionHistory, useCorrectCashClosing } from '../hooks/useCashSessions'
import { Spinner } from '../../../shared/components/Spinner'
import { sileo } from 'sileo'
import { cashDifferenceReasons } from '../constants'

export function CashSessionHistory() {
  const { data, isLoading } = useCashSessionHistory()
  const { mutate: correctClosing, isPending: isCorrecting } = useCorrectCashClosing()
  const [correctingSessionId, setCorrectingSessionId] = useState<string | null>(null)
  const [correctionAmount, setCorrectionAmount] = useState('')
  const [correctionReason, setCorrectionReason] = useState('')
  const [correctionComment, setCorrectionComment] = useState('')

  const handleCorrect = (sessionId: string) => {
    if (!correctionAmount || isNaN(parseFloat(correctionAmount))) {
      sileo.error({ title: 'Error', description: 'Ingresa un monto válido' })
      return
    }
    if (!correctionReason) {
      sileo.error({ title: 'Error', description: 'Selecciona un motivo de corrección' })
      return
    }

    correctClosing(
      { sessionId, correctedAmount: parseFloat(correctionAmount), reason: correctionReason, comment: correctionComment || undefined },
      {
        onSuccess: () => {
          setCorrectingSessionId(null)
          setCorrectionAmount('')
          setCorrectionReason('')
          setCorrectionComment('')
        },
      }
    )
  }

  if (isLoading) {
    return <div className="flex justify-center py-8"><Spinner /></div>
  }

  const closedSessions = data?.data?.filter((s) => s.status === 'closed') || []

  if (closedSessions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No hay cierres de caja registrados
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg" style={{ color: 'var(--color-text-primary)' }}>
        Historial de Cierres
      </h3>

      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
        <table className="w-full text-sm" style={{ backgroundColor: 'var(--color-surface)' }}>
          <thead style={{ backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
            <tr>
              <th className="p-4 text-left font-semibold" style={{ color: 'var(--color-text-primary)' }}>Fecha</th>
              <th className="p-4 text-right font-semibold" style={{ color: 'var(--color-text-primary)' }}>Monto Esperado</th>
              <th className="p-4 text-right font-semibold" style={{ color: 'var(--color-text-primary)' }}>Monto Contado</th>
              <th className="p-4 text-right font-semibold" style={{ color: 'var(--color-text-primary)' }}>Diferencia</th>
              <th className="p-4 text-center font-semibold" style={{ color: 'var(--color-text-primary)' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {closedSessions.map((session) => {
              const expected = parseFloat(String(session.expectedAmount))
              const closing = parseFloat(String(session.closingAmount || 0))
              const difference = closing - expected
              const isCorrectingThis = correctingSessionId === session.id

              return (
                <tr
                  key={session.id}
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                  }}
                >
                  <td className="p-4" style={{ color: 'var(--color-text-primary)' }}>
                    {session.closedAt ? new Date(session.closedAt).toLocaleString('es-ES') : '—'}
                  </td>
                  <td className="p-4 text-right" style={{ color: 'var(--color-text-primary)' }}>
                    ${expected.toFixed(2)}
                  </td>
                  <td className="p-4 text-right" style={{ color: 'var(--color-text-primary)' }}>
                    ${closing.toFixed(2)}
                  </td>
                  <td className="p-4 text-right" style={{ color: difference < 0 ? 'var(--color-text-secondary)' : 'var(--color-primary)' }}>
                    {difference < 0 ? '-' : ''}${Math.abs(difference).toFixed(2)}
                  </td>
                  <td className="p-4 text-center">
                    {isCorrectingThis ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.01"
                            value={correctionAmount}
                            onChange={(e) => setCorrectionAmount(e.target.value)}
                            placeholder="Nuevo monto"
                            aria-label={`Nuevo monto de cierre para sesión ${session.id}`}
                            className="px-2 py-1 border rounded text-sm flex-1"
                            style={{
                              borderColor: 'var(--color-border)',
                              backgroundColor: 'var(--color-surface)',
                              color: 'var(--color-text-primary)',
                            }}
                          />
                        </div>
                        <div>
                          <select
                            value={correctionReason}
                            onChange={(e) => setCorrectionReason(e.target.value)}
                            className="px-2 py-1 border rounded text-sm w-full"
                            style={{
                              borderColor: 'var(--color-border)',
                              backgroundColor: 'var(--color-surface)',
                              color: 'var(--color-text-primary)',
                            }}
                          >
                            <option value="">Selecciona un motivo</option>
                            {cashDifferenceReasons.map((reason) => (
                              <option key={reason} value={reason}>{reason}</option>
                            ))}
                          </select>
                        </div>
                        <textarea
                          value={correctionComment}
                          onChange={(e) => setCorrectionComment(e.target.value)}
                          placeholder="Comentario (opcional)"
                          rows={2}
                          className="px-2 py-1 border rounded text-sm w-full"
                          style={{
                            borderColor: 'var(--color-border)',
                            backgroundColor: 'var(--color-surface)',
                            color: 'var(--color-text-primary)',
                          }}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCorrect(session.id)}
                            disabled={isCorrecting || !correctionReason}
                            className="flex-1 px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:opacity-50"
                          >
                            {isCorrecting ? 'Guardando...' : 'Guardar'}
                          </button>
                          <button
                            onClick={() => {
                              setCorrectingSessionId(null)
                              setCorrectionAmount('')
                              setCorrectionReason('')
                              setCorrectionComment('')
                            }}
                            className="px-2 py-1 border rounded text-xs"
                            style={{
                              borderColor: 'var(--color-border)',
                              color: 'var(--color-text-primary)',
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setCorrectingSessionId(session.id)
                          setCorrectionAmount(closing.toString())
                        }}
                        className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                      >
                        Corregir
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
