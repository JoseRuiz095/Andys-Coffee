import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  /** One short line; the tab already says where the user is. */
  description?: ReactNode
  /** The screen's primary action (and at most one secondary one), aligned right. */
  actions?: ReactNode
}

/** Compact page header shared by every section: one title level, actions on the right. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[1.375rem] font-semibold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
          {title}
        </h1>
        {description && (
          <p className="mt-0.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
