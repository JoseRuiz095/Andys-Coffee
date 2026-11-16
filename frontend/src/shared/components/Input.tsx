import type { ComponentProps } from 'react'
import { useTheme } from '../assets/theme'

// ComponentProps includes `ref` (React 19 passes it as a regular prop).
type InputProps = ComponentProps<'input'>

const baseClassName =
  // text-sm: readable on the POS screens; the focus ring replaces the removed outline.
  'min-h-11 w-full min-w-0 rounded-md border px-4 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-primary)_35%,transparent)] disabled:cursor-not-allowed disabled:opacity-60'

export function Input({ className = '', style, ...props }: InputProps) {
  const { colors } = useTheme()
  const inputClassName = `${baseClassName} ${className}`.trim()

  return (
    <input
      className={inputClassName}
      style={{
        backgroundColor: colors.inputBg,
        borderColor: colors.border,
        color: colors.inputText,
        ...style,
      }}
      {...props}
    />
  )
}
