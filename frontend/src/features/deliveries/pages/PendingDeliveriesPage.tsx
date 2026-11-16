import React from 'react';
import { usePendingDeliveries } from '../hooks/useDeliveries';
import { HandoffDeliveryModal } from '../components/HandoffDeliveryModal';
import type { PendingDelivery } from '../api/deliveries.api';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import { TableSkeleton } from '../../../shared/components/TableSkeleton';
import { QueryErrorState } from '../../../shared/components/QueryErrorState';
import { hasPermission } from '../../auth/utils/permissions';
import { useCurrentUser } from '../../auth/hooks/useCurrentUser';
import { formatDayAndTime } from '../../../shared/utils/dateUtils'
import { formatPaymentMethod } from '../../../shared/constants/paymentMethods'
import { PageHeader } from '../../../shared/components/PageHeader';


export function PendingDeliveriesPage() {
  const { data: deliveries, isLoading, isError, error, refetch, isFetching } = usePendingDeliveries();
  // Settling or handing off needs sales.create on the server.
  const canSettle = hasPermission(useCurrentUser(), 'sales.create');
  const [selectedDelivery, setSelectedDelivery] = React.useState<PendingDelivery | null>(null);

  const totalPending = (deliveries ?? []).reduce((sum, d) => sum + Number(d.deliveryAmount), 0);

  return (
    <div>
      <PageHeader
        title="Mandaditos"
        description={"Dinero de terceros que Andy's recibió y aún debe entregar al repartidor."}
        actions={
          <p className="text-right">
            <span className="block text-sm" style={{ color: 'var(--color-text-secondary)' }}>Total por entregar</span>
            <span className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {isError ? '—' : formatCurrency(totalPending)}
            </span>
          </p>
        }
      />

      <div
        className="rounded-2xl border shadow-sm overflow-hidden"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        {isLoading ? (
          <TableSkeleton rows={4} columns={6} />
        ) : isError ? (
          <QueryErrorState error={error} subject="los mandaditos pendientes" onRetry={() => void refetch()} isRetrying={isFetching} />
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
                    {formatDayAndTime(delivery.createdAt)}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {formatPaymentMethod(delivery.deliveryPaymentMethod)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {formatCurrency(Number(delivery.deliveryAmount))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canSettle && (
                    <button
                      onClick={() => setSelectedDelivery(delivery)}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--color-button-text)] transition hover:opacity-80"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      Marcar como entregado
                    </button>
                    )}
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
