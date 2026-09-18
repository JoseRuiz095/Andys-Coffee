import React from 'react';
import { usePendingDeliveries } from '../hooks/useDeliveries';
import { HandoffDeliveryModal } from '../components/HandoffDeliveryModal';
import type { PendingDelivery } from '../api/deliveries.api';
import { formatCurrency } from '../../../shared/utils/formatCurrency';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PendingDeliveriesPage() {
  const { data: deliveries, isLoading } = usePendingDeliveries();
  const [selectedDelivery, setSelectedDelivery] = React.useState<PendingDelivery | null>(null);

  const totalPending = (deliveries ?? []).reduce((sum, d) => sum + Number(d.deliveryAmount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Mandaditos por Entregar
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Dinero de terceros que Andy's recibió y aún debe entregar al repartidor.
        </p>
      </div>

      <div
        className="rounded-2xl border p-5 shadow-sm"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
          Total pendiente de entregar
        </span>
        <p className="text-3xl font-bold mt-1" style={{ color: 'var(--color-danger)' }}>
          {formatCurrency(totalPending)}
        </p>
      </div>

      <div
        className="rounded-2xl border shadow-sm overflow-hidden"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        {isLoading ? (
          <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
            Cargando...
          </div>
        ) : !deliveries || deliveries.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
            No hay mandaditos pendientes de entregar.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  Orden
                </th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  Cliente
                </th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  Fecha
                </th>
                <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  Método
                </th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  Monto
                </th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  Acción
                </th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((delivery) => (
                <tr key={delivery.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>
                    #{delivery.orderNumber}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>
                    {delivery.customerName || 'Sin nombre'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {formatDate(delivery.createdAt)}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {delivery.deliveryPaymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {formatCurrency(Number(delivery.deliveryAmount))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedDelivery(delivery)}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-80"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      Marcar como entregado
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <HandoffDeliveryModal
        isOpen={selectedDelivery !== null}
        delivery={selectedDelivery}
        onClose={() => setSelectedDelivery(null)}
      />
    </div>
  );
}
