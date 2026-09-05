import { useState } from 'react'
import { Button } from '../../../shared/components/Button'
import type { CashSession } from '../services/cash.service'

interface CashOpeningPanelProps {
  session: CashSession | null | undefined
  isLoading: boolean
  error?: Error | null
  isOpening: boolean
  onOpen: (openingAmount: number) => void
}

export function CashOpeningPanel({
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

  if (isLoading) {
    return (
      <div className="mx-auto max-w-xl rounded-[1.75rem] border border-[#E7E3DC] bg-[#FDFBF7] p-8 text-center shadow-[0_20px_50px_rgba(45,33,29,0.06)]">
        <p className="text-sm text-[#6B7280]">Verificando el estado de la caja...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl rounded-[1.75rem] border border-[#E7C7C2] bg-[#FFF7F5] p-8 text-center shadow-[0_20px_50px_rgba(45,33,29,0.06)]">
        <h2 className="text-xl font-semibold text-[#8D3B32]">No se pudo consultar la caja</h2>
        <p className="mt-2 text-sm text-[#8D3B32]">{error.message}</p>
      </div>
    )
  }

  if (session) {
    return null
  }

  return (
    <div className="mx-auto max-w-xl rounded-[1.75rem] border border-[#D9E3D6] bg-[#FDFBF7] p-6 shadow-[0_20px_50px_rgba(45,33,29,0.06)] sm:p-8">
      <div className="mb-8 border-b border-[#E7E3DC] pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A6A45]">Inicio de turno</p>
        <h2 className="mt-2 text-2xl font-semibold text-[#2C211D]">Abre la caja para comenzar</h2>
        <p className="mt-2 text-sm leading-6 text-[#6B7280]">
          Registra el efectivo disponible antes de iniciar las ventas del turno.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block text-sm font-medium text-[#2C211D]">
          Fondo inicial
          <div className="mt-2 flex items-center rounded-xl border border-[#E7E3DC] bg-white px-4 focus-within:border-[#5A804F] focus-within:ring-2 focus-within:ring-[#5A804F]/15">
            <span className="text-[#8A6A45]">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={openingAmount}
              onChange={(event) => setOpeningAmount(event.target.value)}
              className="min-h-12 w-full bg-transparent px-3 text-lg font-semibold text-[#2C211D] outline-none"
              aria-label="Fondo inicial"
              disabled={isOpening}
            />
          </div>
        </label>
        {validationError && <p className="text-sm text-[#8D3B32]">{validationError}</p>}
        <Button type="submit" disabled={isOpening} className="max-w-none">
          {isOpening ? 'Abriendo caja...' : 'Abrir caja'}
        </Button>
      </form>
    </div>
  )
}
