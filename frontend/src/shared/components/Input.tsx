import type { InputHTMLAttributes } from 'react'
import { useTheme } from '../assets/theme'

type InputProps = InputHTMLAttributes<HTMLInputElement>

const baseClassName =
  'min-h-11 w-full min-w-0 rounded-md border px-4 text-xs outline-none transition disabled:cursor-not-allowed disabled:opacity-60'

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
        boxShadow: 'none',
        ...style,
      }}
      {...props}
    />
  )
}
