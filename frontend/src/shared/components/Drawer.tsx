import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  ariaLabelledBy: string
  widthClassName?: string
  children: ReactNode
}

/**
 * Right-side slide-over panel. Mirrors Modal.tsx's backdrop/Escape handling,
 * but slides in from the edge instead of scaling in place, and is meant for
 * focused detail views (e.g. a selected user or a role's permissions) rather
 * than short forms.
 *
 * Rendered via portal to escape parent stacking contexts and ensure fixed
 * positioning works correctly regardless of ancestor transforms.
 */
export function Drawer({
  isOpen,
  onClose,
  ariaLabelledBy,
  widthClassName = 'max-w-lg',
  children,
}: DrawerProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

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

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/50"
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            className={`h-screen w-full overflow-y-auto shadow-lg ${widthClassName}`}
            style={{ backgroundColor: 'var(--color-surface)' }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={ariaLabelledBy}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
