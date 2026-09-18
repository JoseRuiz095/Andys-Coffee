import React from 'react';
import { usePendingPayments } from '../hooks/usePendingPayments';
import { SettlePaymentModal } from '../components/SettlePaymentModal';
import type { PendingPayment } from '../api/pending-payments.api';
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

export function PendingPaymentsPage() {
  const { data: payments, isLoading } = usePendingPayments();
  const [selectedPayment, setSelectedPayment] = React.useState<PendingPayment | null>(null);

  const totalPending = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Cuentas por Cobrar
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Ventas registradas con "Pago Pendiente" que aún no se han cobrado.
        </p>
      </div>

      <div
        className="rounded-2xl border p-5 shadow-sm"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
          Total pendiente de cobro
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
                    {formatDate(payment.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {formatCurrency(Number(payment.amount))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedPayment(payment)}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-80"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      Marcar como cobrado
                    </button>
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
