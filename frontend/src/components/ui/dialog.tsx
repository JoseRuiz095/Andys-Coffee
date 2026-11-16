import React, { createContext, useContext, useId } from 'react';
import { Modal } from '../../shared/components/Modal';

// Compound API kept for its callers (POS payment, cash cut, schedule, expenses, menu, notes);
// the overlay itself is the shared Modal, so every dialog layers, scrolls, traps focus and
// closes with Escape the same way.
const DialogTitleIdContext = createContext<string | undefined>(undefined);

const dialogWidths = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
} as const;

const Dialog = ({
  open,
  onOpenChange,
  size = 'md',
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Width of the panel (default md, the size every dialog had before). */
  size?: keyof typeof dialogWidths
  children: React.ReactNode
}) => {
  const titleId = useId();

  return (
    <Modal isOpen={open} onClose={() => onOpenChange(false)} ariaLabelledBy={titleId} maxWidthClassName={dialogWidths[size]}>
      <DialogTitleIdContext.Provider value={titleId}>{children}</DialogTitleIdContext.Provider>
    </Modal>
  );
};

const DialogContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={['p-6', className].filter(Boolean).join(' ')}>{children}</div>
);

const DialogHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="border-b p-4" style={{ borderColor: 'var(--color-border)' }}>{children}</div>
);

/** `sticky` keeps the actions in view while a tall dialog scrolls (the panel is the scroller). */
const DialogFooter = ({ children, sticky = false }: { children: React.ReactNode; sticky?: boolean }) => (
  <div
    className={`flex justify-end gap-2 border-t p-4 ${sticky ? 'sticky bottom-0 z-10' : ''}`.trim()}
    style={{ borderColor: 'var(--color-border)', ...(sticky && { backgroundColor: 'var(--color-surface)' }) }}
  >
    {children}
  </div>
);

const DialogTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 id={useContext(DialogTitleIdContext)} className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>{children}</h2>
);

export { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle };
