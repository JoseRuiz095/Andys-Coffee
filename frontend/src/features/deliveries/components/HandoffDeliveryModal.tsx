import { useId } from 'react';
import { useHandoffDelivery } from '../hooks/useDeliveries';
import type { PendingDelivery } from '../api/deliveries.api';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import { Modal } from '../../../shared/components/Modal';
import { formatPaymentMethod } from '../../../shared/constants/paymentMethods'

interface HandoffDeliveryModalProps {
  isOpen: boolean;
  delivery: PendingDelivery | null;
  onClose: () => void;
}

export function HandoffDeliveryModal({ isOpen, delivery, onClose }: HandoffDeliveryModalProps) {
  const { mutate: handoffDelivery, isPending } = useHandoffDelivery();
  const titleId = useId();
  // Escape, the backdrop and "Cancelar" are ignored while the request is in flight.
  const handleClose = () => {
    if (!isPending) onClose();
  };

  if (!isOpen || !delivery) return null;

  const handleConfirm = () => {
    if (isPending) return;
    handoffDelivery(delivery.id, { onSuccess: () => onClose() });
  };

  return (
    <Modal isOpen onClose={handleClose} ariaLabelledBy={titleId}>
      <div className="p-6">
        <h2 id={titleId} className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Marcar Mandadito como Entregado
        </h2>

        <div className="mb-4 space-y-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          <p>
            <strong>Orden:</strong> #{delivery.orderNumber}
          </p>
          <p>
            <strong>Cliente:</strong> {delivery.customerName || 'Sin nombre'}
          </p>
          <p>
            <strong>Monto:</strong> {formatCurrency(Number(delivery.deliveryAmount))}
          </p>
          <p>
            <strong>Método:</strong> {formatPaymentMethod(delivery.deliveryPaymentMethod)}
          </p>
        </div>

        <p className="mb-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Confirma que este dinero ya se le entregó al repartidor.
        </p>

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
            disabled={isPending}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-[var(--color-button-text)] transition disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {isPending ? 'Confirmando...' : 'Confirmar entrega'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
