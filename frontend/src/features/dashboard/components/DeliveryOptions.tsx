import type { DeliveryResponsible } from '../utils/saleForm'

type DeliveryPaymentMethod = 'cash' | 'transfer'

interface DeliveryOptionsProps {
  amount: string
  responsible?: DeliveryResponsible
  paymentMethod?: DeliveryPaymentMethod
  onAmountChange?: (value: string) => void
  onResponsibleChange?: (value: DeliveryResponsible) => void
  onPaymentMethodChange?: (value: DeliveryPaymentMethod) => void
}

const RESPONSIBLE_OPTIONS: { value: DeliveryResponsible; label: string }[] = [
  { value: 'customer_to_courier', label: 'Cliente paga directamente al repartidor' },
  { value: 'customer_to_business', label: "Cliente paga el mandadito a Andy's" },
  { value: 'business_absorbs', label: "Andy's absorbe el mandadito" },
]

const PAYMENT_OPTIONS: { value: DeliveryPaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
]

// Whole row is the touch target of each radio.
const optionClassName = 'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm pointer-coarse:min-h-11'

/** Cost of the mandadito, who pays it and, when it is paid to Andy's, how. */
export function DeliveryOptions({ amount, responsible, paymentMethod, onAmountChange, onResponsibleChange, onPaymentMethodChange }: DeliveryOptionsProps) {
  const optionStyle = (isSelected: boolean) => ({
    color: 'var(--color-text-primary)',
    backgroundColor: isSelected ? 'color-mix(in srgb, var(--color-primary) 12%, var(--color-surface))' : 'transparent',
  })

  return (
    <div className="space-y-2 rounded-xl border p-2.5" style={{ borderColor: 'var(--color-border)' }}>
      <label className="flex items-center justify-between gap-3 text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
        Costo del mandadito
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          placeholder="$0.00"
          aria-label="Costo del mandadito"
          value={amount}
          onChange={(e) => onAmountChange?.(e.target.value)}
          className="min-h-10 w-28 rounded-lg border px-3 text-right pointer-coarse:min-h-11"
          // Inline font: index.css `input { font: inherit }` overrides font utilities.
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-text-primary)', fontSize: '0.875rem', fontWeight: 600 }}
        />
      </label>

      <fieldset>
        <legend className="mb-1 text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>¿Quién recibe/paga el mandadito?</legend>
        {RESPONSIBLE_OPTIONS.map((option) => (
          <label key={option.value} className={optionClassName} style={optionStyle(responsible === option.value)}>
            <input
              type="radio"
              name="deliveryResponsible"
              className="h-4 w-4 shrink-0 accent-[var(--color-primary)]"
              checked={responsible === option.value}
              onChange={() => onResponsibleChange?.(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      {responsible === 'customer_to_business' && (
        <fieldset>
          <legend className="mb-1 text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Método de pago del mandadito</legend>
          <div className="grid grid-cols-2 gap-1">
            {PAYMENT_OPTIONS.map((option) => (
              <label key={option.value} className={optionClassName} style={optionStyle(paymentMethod === option.value)}>
                <input
                  type="radio"
                  name="deliveryPaymentMethod"
                  className="h-4 w-4 shrink-0 accent-[var(--color-primary)]"
                  checked={paymentMethod === option.value}
                  onChange={() => onPaymentMethodChange?.(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  )
}
