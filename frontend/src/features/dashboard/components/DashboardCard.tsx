import type { ReactNode } from 'react'

interface DashboardCardProps {
  title: string
  /** Optional link or button next to the title (e.g. "Ver todos"). */
  action?: ReactNode
  children: ReactNode
  className?: string
}

/** Frame of every card of the admin summary: same border, padding and title in all its states. */
export function DashboardCard({ title, action, children, className = '' }: DashboardCardProps) {
  return (
    <section
      className={`min-w-0 rounded-2xl border p-5 ${className}`.trim()}
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Empty state inside a DashboardCard. */
export function DashboardCardEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
      {children}
    </p>
  )
}
