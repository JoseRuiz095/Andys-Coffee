import type { ReactNode } from 'react'

type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

interface StatusBadgeProps {
  tone: StatusTone
  children: ReactNode
}

const toneConfig: Record<StatusTone, { bgVar: string; textVar: string }> = {
  success: { bgVar: 'var(--color-success)', textVar: 'var(--color-success)' },
  warning: { bgVar: 'var(--color-warning)', textVar: 'var(--color-warning)' },
  danger: { bgVar: 'var(--color-danger)', textVar: 'var(--color-danger)' },
  info: { bgVar: 'var(--color-info)', textVar: 'var(--color-info)' },
  neutral: { bgVar: 'var(--color-border)', textVar: 'var(--color-text-secondary)' },
}

export function StatusBadge({ tone, children }: StatusBadgeProps) {
  const config = toneConfig[tone]

  return (
    <span
      className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium"
      style={{
        backgroundColor: `color-mix(in srgb, ${config.bgVar} 18%, var(--color-surface))`,
        color: config.textVar,
      }}
    >
      {children}
    </span>
  )
}
