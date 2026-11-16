export interface RowAction {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  /** Accessible name when the label alone is ambiguous (e.g. "Eliminar Latte"). */
  ariaLabel?: string
}

/**
 * Row actions of a table as quiet text buttons: always visible (frequent operations are not
 * hidden in a menu) but without the weight of a colored button per action.
 */
export function RowActions({ actions }: { actions: RowAction[] }) {
  const visible = actions.filter(Boolean)
  if (visible.length === 0) return null
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-1 gap-y-1">
      {visible.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          aria-label={action.ariaLabel}
          className="rounded-md px-2 py-1 text-sm font-medium transition hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          style={{ color: action.danger ? 'var(--color-danger)' : 'var(--color-primary)' }}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}
