import React from 'react';

const Dialog = ({ open, onOpenChange, children }: { open: boolean, onOpenChange: (open: boolean) => void, children: React.ReactNode }) => {
  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
      onClick={() => onOpenChange(false)}
    >
      <div 
        className="bg-white rounded-lg shadow-lg w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

const DialogContent = ({ children }: { children: React.ReactNode }) => (
  <div className="p-6">{children}</div>
);

const DialogHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="border-b p-4">{children}</div>
);

const DialogFooter = ({ children }: { children: React.ReactNode }) => (
  <div className="border-t p-4 flex justify-end gap-2">{children}</div>
);

const DialogTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-lg font-semibold">{children}</h2>
);

export { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle };
