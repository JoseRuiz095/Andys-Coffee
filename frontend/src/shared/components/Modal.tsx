import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'

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
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => {
      initialFocusRef?.current?.focus()
    }, 0)
    return () => clearTimeout(timer)
  }, [isOpen, initialFocusRef])

  useEffect(() => {
    if (!isOpen) return
    // Capture phase + stopPropagation: Escape closes only this modal, not a Drawer under it.
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onCloseRef.current()
    }
    document.addEventListener('keydown', handleEscape, true)
    return () => document.removeEventListener('keydown', handleEscape, true)
  }, [isOpen])

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
        className={`max-h-[90vh] w-full overflow-y-auto rounded-lg shadow-lg ${maxWidthClassName}`}
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
