import React from 'react';
import { usePendingPayments } from '../hooks/usePendingPayments';
import { SettlePaymentModal } from '../components/SettlePaymentModal';
import type { PendingPayment } from '../api/pending-payments.api';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import { TableSkeleton } from '../../../shared/components/TableSkeleton';
import { QueryErrorState } from '../../../shared/components/QueryErrorState';
import { hasPermission } from '../../auth/utils/permissions';
import { useCurrentUser } from '../../auth/hooks/useCurrentUser';
import { formatDayAndTime } from '../../../shared/utils/dateUtils'
import { PageHeader } from '../../../shared/components/PageHeader';


export function PendingPaymentsPage() {
  const { data: payments, isLoading, isError, error, refetch, isFetching } = usePendingPayments();
  // Settling or handing off needs sales.create on the server.
  const canSettle = hasPermission(useCurrentUser(), 'sales.create');
  const [selectedPayment, setSelectedPayment] = React.useState<PendingPayment | null>(null);

  const totalPending = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div>
      <PageHeader
        title="Cuentas por cobrar"
        description={'Ventas registradas con "Pago pendiente" que aún no se han cobrado.'}
        actions={
          <p className="text-right">
            <span className="block text-sm" style={{ color: 'var(--color-text-secondary)' }}>Total por cobrar</span>
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
          <TableSkeleton rows={4} columns={5} />
        ) : isError ? (
          <QueryErrorState error={error} subject="los pagos pendientes" onRetry={() => void refetch()} isRetrying={isFetching} />
        ) : !payments || payments.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
            No hay pagos pendientes de cobro.
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
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  Monto
                </th>
                <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  Acción
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>
                    #{payment.order.orderNumber}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>
                    {payment.order.customerName || 'Sin nombre'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {formatDayAndTime(payment.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {formatCurrency(Number(payment.amount))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canSettle && (
                    <button
                      onClick={() => setSelectedPayment(payment)}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--color-button-text)] transition hover:opacity-80"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      Marcar como cobrado
                    </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SettlePaymentModal
        isOpen={selectedPayment !== null}
        payment={selectedPayment}
        onClose={() => setSelectedPayment(null)}
      />
    </div>
  );
}
