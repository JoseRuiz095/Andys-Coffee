import React, { createContext, useContext, useId } from 'react';
import { Modal } from '../../shared/components/Modal';

// Compound API kept for its callers (POS payment, cash cut, schedule, expenses, menu, notes);
// the overlay itself is the shared Modal, so every dialog layers, scrolls, traps focus and
// closes with Escape the same way.
const DialogTitleIdContext = createContext<string | undefined>(undefined);

const Dialog = ({ open, onOpenChange, children }: { open: boolean, onOpenChange: (open: boolean) => void, children: React.ReactNode }) => {
  const titleId = useId();

  return (
    <Modal isOpen={open} onClose={() => onOpenChange(false)} ariaLabelledBy={titleId}>
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

const DialogFooter = ({ children }: { children: React.ReactNode }) => (
  <div className="border-t p-4 flex justify-end gap-2" style={{ borderColor: 'var(--color-border)' }}>{children}</div>
);

const DialogTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 id={useContext(DialogTitleIdContext)} className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>{children}</h2>
);

export { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle };
