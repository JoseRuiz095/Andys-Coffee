import { useEffect, useRef, useState } from 'react'
import { sileo } from 'sileo'
import { getErrorMessage } from '../../../shared/utils/errors'
import { useOverlayEscape } from '../../../shared/hooks/useOverlayEscape'
import { hasPermission, SETTINGS_PERMISSION } from '../../auth/utils/permissions'
import { useInventorySettings, useUpdateInventorySettings } from '../hooks/useInventory'
import type { InventorySettings } from '../api/inventory.api'
import { useCurrentUser } from '../../auth/hooks/useCurrentUser'

const SWITCHES: { key: keyof InventorySettings; label: string; help: string }[] = [
  {
    key: 'consumeOnSale',
    label: 'Descontar inventario al vender',
    help: 'Cada venta descuenta los insumos de su receta. Requiere que todos los productos tengan receta.',
  },
  {
    key: 'lowStockNotify',
    label: 'Avisar stock bajo',
    help: 'Notifica cuando un insumo llega a su mínimo o se agota.',
  },
]

/**
 * Inventory switches, in a menu of the stock screen (configuration, not daily operation). Only
 * administrators (settings.manage) can change them; everyone else sees them read-only.
 */
export function InventorySettingsMenu() {
  const canEdit = hasPermission(useCurrentUser(), SETTINGS_PERMISSION)
  const { data: settings } = useInventorySettings()
  const update = useUpdateInventorySettings()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  useOverlayEscape(isOpen, () => setIsOpen(false))

  useEffect(() => {
    if (!isOpen) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [isOpen])

  if (!settings) return null

  const toggle = (key: keyof InventorySettings) => {
    const value = !settings[key]
    update.mutate({ [key]: value }, {
      onSuccess: () => sileo.success({ title: 'Configuración guardada' }),
      onError: (error) => sileo.error({ title: 'No se pudo cambiar', description: getErrorMessage(error, 'Intenta de nuevo.') }),
    })
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition hover:bg-[var(--color-surface-hover)]"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
        Ajustes del inventario
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Ajustes del inventario"
          className="absolute right-0 z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] space-y-3 rounded-xl border p-4 shadow-[var(--shadow-popover)]"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
          {SWITCHES.map(({ key, label, help }) => (
            <div key={key} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{label}</p>
                <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>{help}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings[key]}
                aria-label={label}
                disabled={!canEdit || update.isPending}
                onClick={() => toggle(key)}
                className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: settings[key] ? 'var(--color-success)' : 'var(--color-border)' }}
              >
                <span
                  className="absolute top-0.5 h-5 w-5 rounded-full transition-all"
                  style={{ left: settings[key] ? '1.375rem' : '0.125rem', backgroundColor: 'var(--color-surface)' }}
                />
              </button>
            </div>
          ))}
          {!canEdit && (
            <p className="border-t pt-3 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
              Solo un administrador puede cambiar estos ajustes.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
