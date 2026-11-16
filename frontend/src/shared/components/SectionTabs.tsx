import { useRef, type KeyboardEvent } from 'react'

export interface SectionTabItem<T extends string> {
  id: T
  label: string
}

interface SectionTabsProps<T extends string> {
  items: readonly SectionTabItem<T>[]
  value: T
  onChange: (id: T) => void
  ariaLabel: string
}

/**
 * Sticky, underlined tabs with the sections of a module (Inventario, Administración). Their
 * views, when a section has several, go in a SegmentedTabs below. Keyboard: ←/→, Home/End.
 */
export function SectionTabs<T extends string>({ items, value, onChange, ariaLabel }: SectionTabsProps<T>) {
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
    <div className="sticky top-0 z-10 overflow-x-auto border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <nav role="tablist" aria-label={ariaLabel} className="flex min-w-max gap-1 md:min-w-0">
          {items.map((item, index) => {
            const isActive = item.id === value
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
                onClick={() => !isActive && onChange(item.id)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className="border-b-2 px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color-mix(in_srgb,var(--color-primary)_45%,transparent)]"
                style={{
                  borderColor: isActive ? 'var(--color-primary)' : 'transparent',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                }}
              >
                {item.label}
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
