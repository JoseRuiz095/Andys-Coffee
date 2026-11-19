import { useRef, type ComponentType, type KeyboardEvent } from 'react'

export interface SegmentedTabItem<T extends string> {
  id: T
  label: string
  icon?: ComponentType<{ size?: number; 'aria-hidden'?: boolean | 'true' }>
}

interface SegmentedTabsProps<T extends string> {
  items: readonly SegmentedTabItem<T>[]
  value: T
  onChange: (id: T) => void
  ariaLabel: string
  className?: string
}

/**
 * Secondary tabs inside a section (e.g. Compras: Nueva compra · Por recibir · Sugerencias).
 * Keyboard: ←/→ move between tabs, Home/End jump to the ends (only the active tab is in the
 * Tab order, as in a WAI-ARIA tablist).
 */
export function SegmentedTabs<T extends string>({ items, value, onChange, ariaLabel, className = '' }: SegmentedTabsProps<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  const focusAt = (index: number) => {
    const next = (index + items.length) % items.length
    onChange(items[next].id)
    buttons.current[next]?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight') focusAt(index + 1)
    else if (event.key === 'ArrowLeft') focusAt(index - 1)
    else if (event.key === 'Home') focusAt(0)
    else if (event.key === 'End') focusAt(items.length - 1)
    else return
    event.preventDefault()
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border p-1 ${className}`.trim()}
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      {items.map((item, index) => {
        const isActive = item.id === value
        const Icon = item.icon
        return (
          <button
            key={item.id}
            ref={(element) => {
              buttons.current[index] = element
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className="inline-flex min-h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-primary)_45%,transparent)]"
            style={{
              backgroundColor: isActive ? 'color-mix(in srgb, var(--color-primary) 14%, var(--color-surface))' : 'transparent',
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            }}
          >
            {Icon && <Icon size={16} aria-hidden="true" />}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
