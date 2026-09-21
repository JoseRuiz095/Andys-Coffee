import { StatusBadge } from '../../../shared/components/StatusBadge';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import type { DailyOrder, DailyOrderStatus } from '../types/daily-orders.types';

interface DailyOrdersTableProps {
  orders: DailyOrder[];
  isLoading: boolean;
  onSelectOrder: (order: DailyOrder) => void;
}

const statusTextMap: Record<DailyOrderStatus, string> = {
  pending: 'Pendiente',
  preparing: 'Preparando',
  ready: 'Listo',
  completed: 'Completado',
  cancelled: 'Cancelada',
};

const statusToneMap: Record<DailyOrderStatus, 'warning' | 'info' | 'success' | 'danger' | 'neutral'> = {
  pending: 'warning',
  preparing: 'info',
  ready: 'success',
  completed: 'success',
  cancelled: 'danger',
};

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPaymentMethodsText(methods: string[]): string {
  const unique = [...new Set(methods)];
  const methodMap: Record<string, string> = {
    cash: 'Efectivo',
    transfer: 'Transferencia',
    card: 'Tarjeta',
    pending: 'Pendiente',
  };
  return unique.map((m) => methodMap[m] || m).join(', ');
}

export function DailyOrdersTable({ orders, isLoading, onSelectOrder }: DailyOrdersTableProps) {
  if (isLoading) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
        Cargando órdenes...
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
        No hay órdenes para este día.
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border shadow-sm overflow-hidden"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              Orden
            </th>
            <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              Hora
            </th>
            <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              Cliente
            </th>
            <th className="text-left px-4 py-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              Métodos de Pago
            </th>
            <th className="text-center px-4 py-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              Envío/Recolección
            </th>
            <th className="text-right px-4 py-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              Total
            </th>
            <th className="text-center px-4 py-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              Estado
            </th>
            <th className="text-center px-4 py-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
              Acción
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>
                #{order.orderNumber}
              </td>
              <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                {formatTime(order.createdAt)}
              </td>
              <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>
                {order.customerName || 'Sin nombre'}
              </td>
              <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>
                {getPaymentMethodsText(order.payments.map((p) => p.method))}
              </td>
              <td className="px-4 py-3 text-center" style={{ color: 'var(--color-text-secondary)' }}>
                {order.hasDelivery ? '📦 Envío' : '🏪 Recolección'}
              </td>
              <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {formatCurrency(Number(order.total))}
              </td>
              <td className="px-4 py-3 text-center">
                <StatusBadge tone={statusToneMap[order.status]}>
                  {statusTextMap[order.status]}
                </StatusBadge>
              </td>
              <td className="px-4 py-3 text-center">
                <button
                  onClick={() => onSelectOrder(order)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-80"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  Ver detalle
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
