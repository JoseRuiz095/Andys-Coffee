import { useHandoffDelivery } from '../hooks/useDeliveries';
import type { PendingDelivery } from '../api/deliveries.api';
import { formatCurrency } from '../../../shared/utils/formatCurrency';

interface HandoffDeliveryModalProps {
  isOpen: boolean;
  delivery: PendingDelivery | null;
  onClose: () => void;
}

export function HandoffDeliveryModal({ isOpen, delivery, onClose }: HandoffDeliveryModalProps) {
  const { mutate: handoffDelivery, isPending } = useHandoffDelivery();

  if (!isOpen || !delivery) return null;

  const handleConfirm = () => {
    handoffDelivery(delivery.id, { onSuccess: () => onClose() });
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
            <strong>Método:</strong> {delivery.deliveryPaymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}
          </p>
        </div>

        <p className="mb-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Confirma que este dinero ya se le entregó al repartidor.
        </p>

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
            {isPending ? 'Confirmando...' : 'Confirmar entrega'}
          </button>
        </div>
      </div>
    </div>
  );
}
