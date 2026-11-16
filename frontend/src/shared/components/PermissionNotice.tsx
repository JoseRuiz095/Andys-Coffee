import type { ReactNode } from 'react'

interface PermissionNoticeProps {
  /** What the user can't do, e.g. "registrar salidas". */
  action: string
  /** Optional link to a related view the user can use instead. */
  children?: ReactNode
}

/**
 * Shown instead of a form the user has no permission to use (a disabled form only adds noise).
 * The lists of the screen stay visible.
 */
export function PermissionNotice({ action, children }: PermissionNoticeProps) {
  return (
    <div
      role="status"
      className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-4 py-3 text-sm"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'color-mix(in srgb, var(--color-info) 8%, var(--color-surface))',
        color: 'var(--color-text-primary)',
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0" aria-hidden="true" style={{ color: 'var(--color-info)' }}>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
      </svg>
      <span>
        No tienes permiso para {action}. Si lo necesitas, pídelo a un administrador.
      </span>
      {children}
    </div>
  )
}
