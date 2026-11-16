import type { ReactNode } from 'react'
import { fieldDescriptionId } from '../utils/formField'

interface FormFieldProps {
  /** id of the control inside, so clicking the label focuses it. */
  htmlFor: string
  label: string
  required?: boolean
  /** Short help under the field; replaced by the error when there is one. */
  hint?: ReactNode
  error?: string | null
  children: ReactNode
  className?: string
}

/**
 * Label + control + help or error, with the error next to the field it belongs to (not only in
 * a toast). Pass `aria-describedby={fieldDescriptionId(id)}` and `aria-invalid` to the control.
 */
export function FormField({ htmlFor, label, required = false, hint, error, children, className = '' }: FormFieldProps) {
  const description = error || hint
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
        {label}
        {required ? (
          <span aria-hidden="true" style={{ color: 'var(--color-danger)' }}> *</span>
        ) : (
          <span className="font-normal" style={{ color: 'var(--color-text-secondary)' }}> (opcional)</span>
        )}
      </label>
      {children}
      {description && (
        <p
          id={fieldDescriptionId(htmlFor)}
          role={error ? 'alert' : undefined}
          className="mt-1 text-sm"
          style={{ color: error ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}
        >
          {description}
        </p>
      )}
    </div>
  )
}
