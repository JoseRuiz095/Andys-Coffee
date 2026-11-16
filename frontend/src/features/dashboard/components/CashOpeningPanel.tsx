import { useState } from 'react'
import { Button } from '../../../shared/components/Button'
import type { CashSession } from '../services/cash.service'
import { getErrorMessage } from '../../../shared/utils/errors'

interface CashOpeningPanelProps {
  /** cash.open: also needed to read the active session (GET /cash-register/sessions/active). */
  canOpen?: boolean
  session: CashSession | null | undefined
  isLoading: boolean
  error?: Error | null
  isOpening: boolean
  onOpen: (openingAmount: number) => void
}

export function CashOpeningPanel({
  canOpen = true,
  session,
  isLoading,
  error,
  isOpening,
  onOpen,
}: CashOpeningPanelProps) {
  const [openingAmount, setOpeningAmount] = useState('0')
  const [validationError, setValidationError] = useState('')

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const amount = Number(openingAmount)
    if (!Number.isFinite(amount) || amount < 0) {
      setValidationError('Ingresa un fondo inicial válido.')
      return
    }
    setValidationError('')
    onOpen(amount)
  }

  if (!canOpen) {
    return (
      <div
        className="mx-auto max-w-xl rounded-[1.75rem] border p-8 text-center shadow-[var(--shadow-card)]"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>No puedes abrir la caja</h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Para vender se necesita una caja abierta. Pide a un administrador que abra la caja o que te dé el permiso.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div
        className="mx-auto max-w-xl rounded-[1.75rem] border p-8 text-center shadow-[var(--shadow-card)]"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Verificando el estado de la caja...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="mx-auto max-w-xl rounded-[1.75rem] border p-8 text-center shadow-[var(--shadow-card)]"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>No se pudo consultar la caja</h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{getErrorMessage(error, 'Revisa tu conexión e inténtalo de nuevo.')}</p>
      </div>
    )
  }

  if (session) {
    return null
  }

  return (
    <div
      className="mx-auto max-w-xl rounded-[1.75rem] border p-6 shadow-[var(--shadow-card)] sm:p-8"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="mb-8 border-b pb-6" style={{ borderColor: 'var(--color-border)' }}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--color-primary)' }}>Inicio de turno</p>
        <h2 className="mt-2 text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>Abre la caja para comenzar</h2>
        <p className="mt-2 text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>
          Registra el efectivo disponible antes de iniciar las ventas del turno. Las transferencias no se suman al efectivo esperado.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          Fondo inicial
          <div
            className="mt-2 flex items-center rounded-xl border px-4 focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--color-primary)_15%,transparent)]"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)' }}
          >
            <span style={{ color: 'var(--color-primary)' }}>$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={openingAmount}
              onChange={(event) => setOpeningAmount(event.target.value)}
              className="min-h-12 w-full bg-transparent px-3 text-lg font-semibold outline-none"
              style={{ color: 'var(--color-input-text)' }}
              aria-label="Fondo inicial"
              disabled={isOpening}
            />
          </div>
        </label>
        {validationError && <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{validationError}</p>}
        <Button type="submit" disabled={isOpening} className="max-w-none">
          {isOpening ? 'Abriendo caja...' : 'Abrir caja'}
        </Button>
      </form>
    </div>
  )
}
