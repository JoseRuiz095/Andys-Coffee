import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

const Dialog = ({ open, onOpenChange, children }: { open: boolean, onOpenChange: (open: boolean) => void, children: React.ReactNode }) => {
  useEffect(() => {
    if (!open) return;

    const scrollPosition = window.scrollY;

    document.body.style.overflow = 'hidden';
    document.body.style.top = `-${scrollPosition}px`;
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollPosition);
    };
  }, [open]);

  if (!open) return null;

  const dialogContent = (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="rounded-lg shadow-lg w-full max-w-md"
        style={{ backgroundColor: 'var(--color-surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  const portalRoot = document.getElementById('modal-root');
  if (!portalRoot) return dialogContent;

  return createPortal(dialogContent, portalRoot);
};

const DialogContent = ({ children }: { children: React.ReactNode }) => (
  <div className="p-6">{children}</div>
);

const DialogHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="border-b p-4" style={{ borderColor: 'var(--color-border)' }}>{children}</div>
);

const DialogFooter = ({ children }: { children: React.ReactNode }) => (
  <div className="border-t p-4 flex justify-end gap-2" style={{ borderColor: 'var(--color-border)' }}>{children}</div>
);

const DialogTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>{children}</h2>
);

export { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle };
