import React from 'react'
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import { Button } from '../../../shared/components/Button'
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from '../../../components/ui/dialog'
import type { ComboTemperature, MenuItem, SelectedExtra } from '../types/menu.types'

interface ComboTemperatureModalProps {
  combo: MenuItem
  onClose: () => void
  onAddToOrder?: (item: MenuItem, quantity: number, extras?: SelectedExtra[], comboTemperatures?: ComboTemperature[]) => void
}

const OPTIONS = [
  { value: 'HOT', label: 'Caliente' },
  { value: 'COLD', label: 'Frío' },
] as const

/**
 * Hot or cold for each drink of a combo sold both ways (audit 2026-11-17, A3): the sale
 * consumes that recipe (cup, lid, ice) and the orders board shows it.
 */
export function ComboTemperatureModal({ combo, onClose, onAddToOrder }: ComboTemperatureModalProps) {
  const choices = combo.temperatureChoices ?? []
  const [selected, setSelected] = React.useState<Record<string, ComboTemperature['temperature']>>({})
  const complete = choices.every((choice) => selected[choice.productId])

  return (
    <Dialog open={true} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{combo.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {choices.map((choice) => (
            <div key={choice.productId} role="group" aria-label={`Temperatura de ${choice.name}`}>
              <p className="mb-2 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{choice.name}</p>
              <div className="grid grid-cols-2 gap-2">
                {OPTIONS.map((option) => {
                  const active = selected[choice.productId] === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelected((current) => ({ ...current, [choice.productId]: option.value }))}
                      className="min-h-11 rounded-xl border px-3 transition"
                      style={{
                        fontSize: '0.9375rem',
                        fontWeight: active ? 600 : 500,
                        borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
                        backgroundColor: active ? 'color-mix(in srgb, var(--color-primary) 14%, var(--color-surface))' : 'var(--color-surface)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-xl border px-4 py-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-hover)' }}>
            <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>Precio</span>
            <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--color-primary)' }}>{formatCurrency(combo.price)}</span>
          </div>
        </div>
        <DialogFooter sticky>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!complete}
            onClick={() => {
              onAddToOrder?.(combo, 1, [], choices.map((choice) => ({ productId: choice.productId, temperature: selected[choice.productId] })))
              onClose()
            }}
          >
            Agregar al pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
