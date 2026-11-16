import React, { useId } from 'react';
import { useSettlePayment } from '../hooks/usePendingPayments';
import type { PendingPayment, SettleMethod } from '../api/pending-payments.api';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import { Modal } from '../../../shared/components/Modal';

interface SettlePaymentModalProps {
  isOpen: boolean;
  payment: PendingPayment | null;
  onClose: () => void;
}

export function SettlePaymentModal({ isOpen, payment, onClose }: SettlePaymentModalProps) {
  const { mutate: settlePayment, isPending } = useSettlePayment();
  const [method, setMethod] = React.useState<SettleMethod>('cash');
  const [cashReceived, setCashReceived] = React.useState('');
  const titleId = useId();
  // Escape, the backdrop and "Cancelar" are ignored while the request is in flight.
  const handleClose = () => {
    if (!isPending) onClose();
  };

  // Default to cash each time the modal opens (adjusting state during render, not in an effect).
  const [wasOpen, setWasOpen] = React.useState(false);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setMethod('cash');
      setCashReceived('');
    }
  }

  if (!isOpen || !payment) return null;

  const amount = Number(payment.amount);
  const received = Number(cashReceived);
  const hasReceived = method === 'cash' && cashReceived !== '';
  const change = hasReceived ? received - amount : null;
  // In cash the received amount is required, so the change handed back is recorded.
  const canConfirm = method !== 'cash' || (hasReceived && Number.isFinite(received) && received >= amount);

  const handleConfirm = () => {
    if (isPending || !canConfirm) return;
    settlePayment(
      { paymentId: payment.id, method, cashReceived: method === 'cash' ? received : undefined },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Modal isOpen onClose={handleClose} ariaLabelledBy={titleId}>
      <div className="p-6">
        <h2 id={titleId} className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
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
          <option value="card">Tarjeta</option>
        </select>

        {method === 'cash' && (
          <div className="mb-4 space-y-2">
            <label className="block text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Monto recibido
              <input
                type="number"
                min="0"
                step="0.01"
                autoFocus
                value={cashReceived}
                onChange={(event) => setCashReceived(event.target.value)}
                disabled={isPending}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
              />
            </label>
            <p className="flex justify-between text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <span>Cambio</span>
              <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {change !== null && change >= 0 ? formatCurrency(change) : '—'}
              </span>
            </p>
            {change !== null && change < 0 && (
              <p className="text-xs" style={{ color: 'var(--color-danger)' }}>El monto recibido debe cubrir el pago.</p>
            )}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={handleClose}
            disabled={isPending}
            className="rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending || !canConfirm}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-[var(--color-button-text)] transition disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {isPending ? 'Liquidando...' : 'Confirmar cobro'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
