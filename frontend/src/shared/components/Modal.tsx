import type { ReactNode } from 'react'
import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { useOverlayEscape } from '../hooks/useOverlayEscape'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  ariaLabelledBy: string
  initialFocusRef?: { current: HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement | HTMLSelectElement | HTMLElement | null }
  maxWidthClassName?: string
  children: ReactNode
}

export function Modal({
  isOpen,
  onClose,
  ariaLabelledBy,
  initialFocusRef,
  maxWidthClassName = 'max-w-md',
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(isOpen, panelRef, initialFocusRef)

  useOverlayEscape(isOpen, onClose)
  useBodyScrollLock(isOpen)

  if (!isOpen) return null

  // Rendered via portal: a transformed ancestor (framer-motion page transitions)
  // would otherwise become the containing block of this fixed overlay.
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-lg shadow-lg outline-none ${maxWidthClassName}`}
        style={{ backgroundColor: 'var(--color-surface)' }}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
      >
        {children}
      </motion.div>
    </div>,
    document.getElementById('modal-root') ?? document.body
  )
}
