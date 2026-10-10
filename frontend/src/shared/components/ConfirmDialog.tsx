import { useId } from 'react'
import { createPortal } from 'react-dom'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { useOverlayEscape } from '../hooks/useOverlayEscape'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  isDangerous?: boolean
  isLoading?: boolean
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  isDangerous = false,
  isLoading = false,
}: ConfirmDialogProps) {
  const titleId = useId()
  useBodyScrollLock(isOpen)
  useOverlayEscape(isOpen, () => {
    if (!isLoading) onCancel()
  })

  if (!isOpen) return null

  // Layering: Drawer z-50 < Modal z-[60] < ConfirmDialog z-[70], so a confirmation
  // opened from a drawer or a modal is always on top of it.
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50"
      onClick={() => {
        if (!isLoading) onCancel()
      }}
      role="presentation"
    >
      <div
        className="rounded-lg shadow-lg p-6 max-w-sm w-full mx-4"
        style={{ backgroundColor: 'var(--color-surface)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={isLoading}
      >
        <h2
          id={titleId}
          className="text-lg font-semibold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {title}
        </h2>
        <p
          className="mt-2 text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {message}
        </p>
        <div className="mt-6 flex gap-3 justify-end">
          <button
            onClick={() => {
              if (!isLoading) onCancel()
            }}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium transition"
            style={{
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              backgroundColor: isDangerous ? 'var(--color-danger)' : 'var(--color-primary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDangerous
                ? 'var(--color-danger-hover)'
                : 'var(--color-primary-hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isDangerous
                ? 'var(--color-danger)'
                : 'var(--color-primary)'
            }}
          >
            {isLoading ? 'Procesando...' : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.getElementById('modal-root') ?? document.body
  )
}
