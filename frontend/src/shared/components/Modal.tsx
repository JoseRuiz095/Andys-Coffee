import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

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
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const scrollPosition = window.scrollY

    document.body.style.overflow = 'hidden'
    document.body.style.top = `-${scrollPosition}px`
    document.body.style.position = 'fixed'
    document.body.style.width = '100%'

    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, scrollPosition)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <motion.div
        className={`w-full rounded-lg shadow-lg ${maxWidthClassName}`}
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
    </div>
  )
}
