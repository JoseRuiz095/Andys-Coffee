import type { HTMLAttributes, ReactNode } from 'react'

type CardVariant = 'panel' | 'inset' | 'plain'

type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode
  variant?: CardVariant
}

const variantClassName: Record<CardVariant, string> = {
  panel: 'rounded-2xl border p-5 shadow-[0_14px_34px_rgba(45,33,29,0.06)]',
  inset: 'rounded-lg border p-4',
  plain: '',
}

const variantStyle: Record<CardVariant, React.CSSProperties> = {
  panel: { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' },
  inset: { borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' },
  plain: {},
}

export function Card({ children, className = '', variant = 'plain', style, ...props }: CardProps) {
  return (
    <section
      className={`${variantClassName[variant]} ${className}`.trim()}
      style={{ ...variantStyle[variant], ...style }}
      {...props}
    >
      {children}
    </section>
  )
}
