import { useEffect, useRef, useState } from 'react'
import { Button } from './Button'

export interface ActionMenuItem {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}

interface ActionMenuProps {
  items: ActionMenuItem[]
  ariaLabel: string
}

/**
 * Compact "[•••]" contextual menu for grouping row-level actions (e.g. a
 * table row or a list item) instead of scattering several buttons across
 * the layout. No such primitive existed in the shared component library.
 */
export function ActionMenu({ items, ariaLabel }: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <Button
        type="button"
        variant="icon"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <span aria-hidden="true" className="text-lg leading-none">⋮</span>
      </Button>

      {isOpen && (
        <div
          role="menu"
          aria-label={ariaLabel}
          className="absolute right-0 z-40 mt-1 w-48 overflow-hidden rounded-lg border shadow-lg"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setIsOpen(false)
                item.onClick()
              }}
              className="block w-full px-4 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{ color: item.danger ? 'var(--color-danger)' : 'var(--color-text-primary)' }}
              onMouseEnter={(e) => {
                if (!item.disabled) e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
