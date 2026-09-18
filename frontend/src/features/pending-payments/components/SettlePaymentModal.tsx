import React from 'react';
import { useSettlePayment } from '../hooks/usePendingPayments';
import type { PendingPayment, SettleMethod } from '../api/pending-payments.api';
import { formatCurrency } from '../../../shared/utils/formatCurrency';

interface SettlePaymentModalProps {
  isOpen: boolean;
  payment: PendingPayment | null;
  onClose: () => void;
}

export function SettlePaymentModal({ isOpen, payment, onClose }: SettlePaymentModalProps) {
  const { mutate: settlePayment, isPending } = useSettlePayment();
  const [method, setMethod] = React.useState<SettleMethod>('cash');

  React.useEffect(() => {
    if (isOpen) setMethod('cash');
  }, [isOpen]);

  if (!isOpen || !payment) return null;

  const handleConfirm = () => {
    settlePayment(
      { paymentId: payment.id, method },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      style={{ backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-lg"
        style={{ backgroundColor: 'var(--color-surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Liquidar Pago Pendiente
        </h2>

        <div className="mb-4 space-y-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          <p>
            <strong>Orden:</strong> #{payment.order.orderNumber}
          </p>
          <p>
            <strong>Cliente:</strong> {payment.order.customerName || 'Sin nombre'}
          </p>
          <p>
            <strong>Monto:</strong> {formatCurrency(Number(payment.amount))}
          </p>
        </div>

        <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
          Método de cobro real
        </label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as SettleMethod)}
          className="w-full rounded-lg border px-3 py-2 text-sm mb-4"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-input-bg)',
            color: 'var(--color-input-text)',
          }}
        >
          <option value="cash">Efectivo</option>
          <option value="transfer">Transferencia</option>
        </select>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {isPending ? 'Liquidando...' : 'Confirmar cobro'}
          </button>
        </div>
      </div>
    </div>
  );
}
