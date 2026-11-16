import React from 'react'
import { AnimatePresence } from 'framer-motion'
import brandLogo from '../../../shared/assets/logo/LetraAndysVector.svg'
import { CoffeeIcon } from '../../../components/ui/coffee'
import type { CoffeeIconHandle } from '../../../components/ui/coffee'
import { SettingsIcon } from '../../../components/ui/settings'
import { APP_ROUTES } from '../../../shared/constants/routes'
import { navigateTo } from '../../../app/navigation'
import { useNotifications } from '../hooks/useNotifications'
import { NotificationCenter } from './NotificationCenter'

export interface DashboardNavItem<T extends string> {
  id: T
  label: string
}

interface DashboardHeaderProps<T extends string> {
  displayName: string
  roleLabel: string
  items: readonly DashboardNavItem<T>[]
  currentView: T
  onSelectView: (view: T) => void
  /** Shown only with an open drawer and cash.close. */
  showCloseCash: boolean
  isClosingCash: boolean
  onCloseCash: () => void
  /** Width of the content below (the sales screen uses a wider one). */
  maxWidthClassName?: string
}

/** Top bar of the dashboard: user, main navigation, cash cut, notifications and settings. */
export function DashboardHeader<T extends string>({
  displayName,
  roleLabel,
  items,
  currentView,
  onSelectView,
  showCloseCash,
  isClosingCash,
  onCloseCash,
  maxWidthClassName = 'max-w-7xl',
}: DashboardHeaderProps<T>) {
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = React.useState(false)
  const coffeeIconRef = React.useRef<CoffeeIconHandle>(null)
  const notificationContainerRef = React.useRef<HTMLDivElement>(null)
  const { unreadCount } = useNotifications()
  const hasUnreadNotifications = unreadCount > 0
  // Four sections don't fit beside the user and the actions below 1024px (tablet in portrait):
  // there they get a row of their own instead of wrapping unpredictably.
  const navOwnRow = items.length >= 4

  React.useEffect(() => {
    if (hasUnreadNotifications) {
      coffeeIconRef.current?.startAnimation()
      return
    }

    coffeeIconRef.current?.stopAnimation()
  }, [hasUnreadNotifications])

  React.useEffect(() => {
    if (!isNotificationCenterOpen) return

    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (!notificationContainerRef.current?.contains(event.target as Node)) {
        setIsNotificationCenterOpen(false)
      }
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown)
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown)
  }, [isNotificationCenterOpen])

  return (
    <header
      className="relative z-50 border-b px-3 py-2 shadow-[var(--shadow-header)] backdrop-blur lg:px-4"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'color-mix(in srgb, var(--color-surface) 96%, transparent)',
      }}
    >
      <div className={`mx-auto flex ${maxWidthClassName} flex-wrap items-center justify-between gap-x-4 gap-y-2`}>
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border p-1.5 shadow-sm"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-background)',
            }}
          >
            <img src={brandLogo} alt="Andys Coffee" className="h-6 w-auto object-contain" />
          </div>
          <div className="min-w-0">
            <div className="max-w-[14rem] truncate text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {displayName}
            </div>
            <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{roleLabel}</div>
          </div>
        </div>

        <nav
          aria-label="Secciones"
          className={`flex items-center gap-1 overflow-x-auto rounded-full border p-1 text-base font-medium shadow-sm ${navOwnRow ? 'order-last w-full justify-center-safe lg:order-none lg:w-auto' : ''}`}
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'color-mix(in srgb, var(--color-surface) 80%, transparent)',
          }}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              aria-current={currentView === item.id ? 'page' : undefined}
              className="min-h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-primary)_45%,transparent)] pointer-coarse:min-h-11"
              style={{
                backgroundColor: currentView === item.id ? 'var(--color-primary)' : 'transparent',
                color: currentView === item.id ? 'var(--color-button-text)' : 'var(--color-text-primary)',
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 text-sm font-semibold">
          {showCloseCash && (
            <button
              type="button"
              onClick={onCloseCash}
              disabled={isClosingCash}
              className="min-h-10 rounded-full bg-[color-mix(in_srgb,var(--color-danger)_10%,var(--color-surface))] px-4 text-sm font-semibold pointer-coarse:min-h-11 shadow-sm transition hover:bg-[color-mix(in_srgb,var(--color-danger)_15%,var(--color-surface))] disabled:opacity-60"
              style={{
                color: 'var(--color-danger)',
                border: '1px solid var(--color-danger)',
              }}
            >
              {isClosingCash ? 'Cerrando...' : 'Cerrar caja'}
            </button>
          )}
          <div ref={notificationContainerRef} className="relative">
            <button
              type="button"
              aria-label={
                hasUnreadNotifications ? `Abrir notificaciones (${unreadCount} sin leer)` : 'Abrir notificaciones del proyecto'
              }
              aria-expanded={isNotificationCenterOpen}
              onClick={() => setIsNotificationCenterOpen((isOpen) => !isOpen)}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border shadow-sm transition focus:outline-none focus:ring-2 pointer-coarse:h-11 pointer-coarse:w-11"
              style={
                hasUnreadNotifications
                  ? ({
                      borderColor: 'var(--color-warning)',
                      backgroundColor: 'color-mix(in srgb, var(--color-warning) 12%, var(--color-surface))',
                      color: 'var(--color-warning)',
                      boxShadow:
                        '0 0 0 4px color-mix(in srgb, var(--color-warning) 14%, transparent), 0 10px 24px color-mix(in srgb, var(--color-warning) 18%, transparent)',
                      '--tw-ring-color': 'var(--color-warning)',
                    } as React.CSSProperties)
                  : ({
                      borderColor: 'var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-primary)',
                      '--tw-ring-color': 'var(--color-primary)',
                    } as React.CSSProperties)
              }
            >
              {hasUnreadNotifications && (
                <>
                  <span className="absolute inset-0 rounded-full border-2 animate-ping" style={{ borderColor: 'color-mix(in srgb, var(--color-warning) 50%, transparent)' }} />
                  <span className="absolute -inset-1.5 rounded-full border" style={{ borderColor: 'color-mix(in srgb, var(--color-warning) 30%, transparent)' }} />
                </>
              )}
              <CoffeeIcon ref={coffeeIconRef} className="relative z-10" size={21} aria-hidden="true" />
              {hasUnreadNotifications && (
                <span
                  aria-hidden="true"
                  className="absolute -right-2 -top-2 z-20 flex h-5 min-w-5 items-center justify-center rounded-full border-2 px-1 text-[10px] font-bold leading-none"
                  style={{
                    borderColor: 'var(--color-surface)',
                    backgroundColor: 'var(--color-danger)',
                    color: 'var(--color-button-text)',
                    boxShadow: '0 4px 10px color-mix(in srgb, var(--color-danger) 35%, transparent)',
                  }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <AnimatePresence>
              {isNotificationCenterOpen && <NotificationCenter onClose={() => setIsNotificationCenterOpen(false)} />}
            </AnimatePresence>
          </div>
          <button
            type="button"
            aria-label="Configuración: mi cuenta, usuarios y datos del negocio"
            title="Configuración"
            onClick={() => navigateTo(APP_ROUTES.settings)}
            className="flex h-10 w-10 items-center justify-center rounded-full border bg-[var(--color-surface)] shadow-sm pointer-coarse:h-11 pointer-coarse:w-11 transition hover:bg-[var(--color-surface-hover)] focus:outline-none focus:ring-2"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-primary)',
              '--tw-ring-color': 'var(--color-primary)',
            } as React.CSSProperties}
          >
            <SettingsIcon size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  )
}
