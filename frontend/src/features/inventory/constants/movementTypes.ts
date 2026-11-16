/** Inventory movement types as the API returns them, in the order the filters list them. */
export const MOVEMENT_TYPES = [
  { value: 'sale', label: 'Venta' },
  { value: 'purchase', label: 'Compra' },
  { value: 'sale_reversal', label: 'Reversión de venta' },
  { value: 'adjustment', label: 'Ajuste' },
  { value: 'exit', label: 'Salida manual' },
] as const

export function getMovementTypeLabel(type: string): string {
  return MOVEMENT_TYPES.find((movementType) => movementType.value === type)?.label ?? type
}

// Theme tokens (not Tailwind palette colors) so the pills follow light and dark mode.
const MOVEMENT_TYPE_PILL: Record<string, string> = {
  sale: 'text-[var(--color-danger)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)]',
  purchase: 'text-[var(--color-success)] bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)]',
  sale_reversal: 'text-[var(--color-info)] bg-[color-mix(in_srgb,var(--color-info)_12%,transparent)]',
  adjustment: 'text-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]',
  exit: 'text-[var(--color-warning)] bg-[color-mix(in_srgb,var(--color-warning)_12%,transparent)]',
}

/** Classes of the type pill shown in the movement lists. */
export function getMovementTypeColor(type: string): string {
  return MOVEMENT_TYPE_PILL[type] ?? 'text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)]'
}
