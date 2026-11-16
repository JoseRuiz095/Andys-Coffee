import type { ComponentProps } from 'react'
import { useTheme } from '../assets/theme'

type SelectProps = ComponentProps<'select'>

const baseClassName =
  // text-sm: readable on the POS screens; the focus ring replaces the removed outline.
  'min-h-11 w-full min-w-0 rounded-md border px-4 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-primary)_35%,transparent)] disabled:cursor-not-allowed disabled:opacity-60'

export function Select({ className = '', style, children, ...props }: SelectProps) {
  const { colors } = useTheme()
  const selectClassName = `${baseClassName} ${className}`.trim()

  return (
    <select
      className={selectClassName}
      style={{
        backgroundColor: colors.inputBg,
        borderColor: colors.border,
        color: colors.inputText,
        ...style,
      }}
      {...props}
    >
      {children}
    </select>
  )
}
