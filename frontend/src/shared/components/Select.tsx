import type { SelectHTMLAttributes } from 'react'
import { useTheme } from '../assets/theme'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

const baseClassName =
  'min-h-11 w-full min-w-0 rounded-md border px-4 text-xs outline-none transition disabled:cursor-not-allowed disabled:opacity-60'

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
        boxShadow: 'none',
        ...style,
      }}
      {...props}
    >
      {children}
    </select>
  )
}
