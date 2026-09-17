interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  isDangerous?: boolean
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
}: ConfirmDialogProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="rounded-lg shadow-lg p-6 max-w-sm w-full mx-4"
        style={{ backgroundColor: 'var(--color-surface)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <h2
          id="confirm-title"
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
            onClick={onCancel}
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
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition"
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
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
