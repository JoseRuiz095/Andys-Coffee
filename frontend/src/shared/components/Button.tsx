import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useTheme } from '../assets/theme'

type ButtonVariant = 'primary' | 'ghost' | 'icon'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: ButtonVariant
}

const variantClassName: Record<ButtonVariant, string> = {
  primary:
    'inline-flex min-h-11 w-full max-w-52 items-center justify-center rounded-full px-6 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-70',
  ghost:
    'inline-flex min-h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md bg-transparent px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-70',
  icon:
    'inline-grid size-9 flex-shrink-0 place-items-center rounded-full bg-transparent transition focus-visible:outline-none focus-visible:ring-2',
}

export function Button({
  children,
  className = '',
  variant = 'primary',
  style,
  ...props
}: ButtonProps) {
  const { colors } = useTheme()
  const buttonClassName = `${variantClassName[variant]} ${className}`.trim()

  const buttonStyle = {
    ...(variant === 'primary' && {
      backgroundColor: colors.accent,
      color: colors.buttonText,
      boxShadow: 'none',
    }),
    ...(variant === 'ghost' && {
      color: colors.textLight,
      backgroundColor: 'transparent',
    }),
    ...(variant === 'icon' && {
      color: colors.surfaceSecondary,
      backgroundColor: 'transparent',
    }),
    ...style,
  }

  return (
    <button className={buttonClassName} style={buttonStyle} {...props}>
      {children}
    </button>
  )
}
