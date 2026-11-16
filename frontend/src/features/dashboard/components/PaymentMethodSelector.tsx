import type { PosPaymentMethod } from '../utils/saleForm'

const OPTIONS: { value: PosPaymentMethod; label: string; title: string }[] = [
  { value: 'cash', label: 'Efectivo', title: 'Efectivo' },
  { value: 'transfer', label: 'Transf.', title: 'Transferencia' },
  { value: 'card', label: 'Tarjeta', title: 'Tarjeta' },
  { value: 'pending', label: 'Pendiente', title: 'Pago pendiente' },
]

interface PaymentMethodSelectorProps {
  value?: PosPaymentMethod
  onChange?: (method: PosPaymentMethod) => void
  disabled?: boolean
}

/**
 * The four payment methods always in view (one tap to change), instead of a select that hides
 * the current one. Short labels so the four fit the narrowest order panel (tablet in portrait).
 */
export function PaymentMethodSelector({ value, onChange, disabled = false }: PaymentMethodSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Método de pago"
      // Font on the group: buttons inherit it (see index.css `button { font: inherit }`).
      className="grid grid-cols-4 gap-1 rounded-xl border p-1 text-[0.8125rem] font-semibold"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)' }}
    >
      {OPTIONS.map((option) => {
        const isSelected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            title={option.title}
            aria-pressed={isSelected}
            disabled={disabled}
            onClick={() => onChange?.(option.value)}
            className="min-h-10 min-w-0 rounded-lg px-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-primary)_45%,transparent)] disabled:opacity-50 pointer-coarse:min-h-11"
            style={{
              backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
              color: isSelected ? 'var(--color-button-text)' : 'var(--color-text-primary)',
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
