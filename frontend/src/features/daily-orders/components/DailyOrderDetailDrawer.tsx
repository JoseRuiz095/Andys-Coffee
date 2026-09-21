import { useState } from 'react';
import { Drawer } from '../../../shared/components/Drawer';
import { Card } from '../../../shared/components/Card';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import { hasPermission } from '../../auth/utils/permissions';
import type { AuthUser } from '../../auth/types/auth.types';
import type { DailyOrder, DailyOrderStatus } from '../types/daily-orders.types';
import { useCancelDailyOrder } from '../hooks/useDailyOrders';

interface DailyOrderDetailDrawerProps {
  isOpen: boolean;
  order: DailyOrder | null;
  currentUser: AuthUser | null;
  date: string;
  onClose: () => void;
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

const deliveryResponsibleLabels: Record<string, string> = {
  customer_to_courier: 'Cliente paga directamente al repartidor',
  customer_to_business: "Cliente paga el mandadito a Andy's",
  business_absorbs: "Andy's absorbe el mandadito",
};

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPaymentMethod(method: string): string {
  const methodMap: Record<string, string> = {
    cash: 'Efectivo',
    transfer: 'Transferencia',
    card: 'Tarjeta',
    pending: 'Pendiente',
  };
  return methodMap[method] || method;
}

export function DailyOrderDetailDrawer({
  isOpen,
  order,
  currentUser,
  date,
  onClose,
}: DailyOrderDetailDrawerProps) {
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const { mutate: cancelOrder, isPending: isCancelling } = useCancelDailyOrder(date);

  if (!order) return null;

  const canCancel = hasPermission(currentUser, 'sales.cancel') &&
    order.status !== 'completed' &&
    order.status !== 'cancelled';

  const handleCancelClick = () => {
    setConfirmCancelOpen(true);
  };

  const handleConfirmCancel = () => {
    setConfirmCancelOpen(false);
    cancelOrder(order.id);
  };

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        ariaLabelledBy="order-detail-title"
        widthClassName="max-w-lg"
      >
        <div className="p-6 space-y-6">
          {/* Header */}
          <div>
            <h2 id="order-detail-title" className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Orden #{order.orderNumber}
            </h2>
            <div className="mt-2 flex items-center gap-3">
              <StatusBadge tone={statusToneMap[order.status]}>
                {statusTextMap[order.status]}
              </StatusBadge>
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {formatDateTime(order.createdAt)}
              </span>
              {order.createdBy && (
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  por {order.createdBy.name}
                </span>
              )}
            </div>
          </div>

          {/* Descripción */}
          {order.notes && (
            <Card variant="inset">
              <div className="space-y-2">
                <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Descripción
                </h3>
                <p style={{ color: 'var(--color-text-secondary)' }}>{order.notes}</p>
              </div>
            </Card>
          )}

          {/* Pago */}
          <Card variant="inset">
            <div className="space-y-3">
              <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Pago
              </h3>
              <div className="space-y-2">
                {order.payments.map((payment) => (
                  <div key={payment.id} className="flex justify-between text-sm">
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      {formatPaymentMethod(payment.method)}
                    </span>
                    <span style={{ color: 'var(--color-text-primary)' }}>
                      {formatCurrency(Number(payment.amount))}
                    </span>
                  </div>
                ))}
              </div>
              {order.receivedAmount !== null && (
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '8px' }}>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--color-text-secondary)' }}>Pagado en efectivo</span>
                    <span style={{ color: 'var(--color-text-primary)' }}>
                      {formatCurrency(Number(order.receivedAmount))}
                    </span>
                  </div>
                  {order.changeAmount !== null && (
                    <div className="flex justify-between text-sm mt-1">
                      <span style={{ color: 'var(--color-text-secondary)' }}>Cambio</span>
                      <span style={{ color: 'var(--color-text-primary)' }}>
                        {formatCurrency(Number(order.changeAmount))}
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div
                style={{ borderTop: '1px solid var(--color-border)', paddingTop: '8px' }}
                className="flex justify-between font-semibold"
              >
                <span style={{ color: 'var(--color-text-primary)' }}>Total</span>
                <span style={{ color: 'var(--color-primary)' }}>{formatCurrency(Number(order.total))}</span>
              </div>
            </div>
          </Card>

          {/* Envío / Recolección */}
          <Card variant="inset">
            <div className="space-y-3">
              <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {order.hasDelivery ? 'Envío' : 'Recolección'}
              </h3>
              {!order.hasDelivery ? (
                <p style={{ color: 'var(--color-text-secondary)' }}>Recolección en tienda</p>
              ) : (
                <div className="space-y-2 text-sm">
                  {order.deliveryResponsible && (
                    <div>
                      <span style={{ color: 'var(--color-text-secondary)' }}>
                        {deliveryResponsibleLabels[order.deliveryResponsible] || order.deliveryResponsible}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-text-secondary)' }}>Monto de envío</span>
                    <span style={{ color: 'var(--color-text-primary)' }}>
                      {formatCurrency(Number(order.deliveryAmount))}
                    </span>
                  </div>
                  {order.deliveryResponsible === 'customer_to_business' && order.deliveryPaymentMethod && (
                    <div>
                      <span style={{ color: 'var(--color-text-secondary)' }}>
                        Método de pago del envío: {formatPaymentMethod(order.deliveryPaymentMethod)}
                      </span>
                    </div>
                  )}
                  {order.deliveryHandedOff && (
                    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '8px' }}>
                      <span style={{ color: 'var(--color-success)' }}>
                        ✓ Entregado {order.deliveryHandedOffAt && `el ${formatDateTime(order.deliveryHandedOffAt)}`}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Productos */}
          <Card variant="inset">
            <div className="space-y-3">
              <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Productos
              </h3>
              <div className="space-y-4">
                {order.items.map((item) => (
                  <div key={item.id} className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--color-text-primary)' }}>
                        {item.productName} × {item.quantity}
                      </span>
                      <span style={{ color: 'var(--color-text-primary)' }}>
                        {formatCurrency(Number(item.subtotal))}
                      </span>
                    </div>
                    {item.extras && item.extras.length > 0 && (
                      <div style={{ marginLeft: '16px', paddingLeft: '16px', borderLeft: '2px solid var(--color-border)' }}>
                        {item.extras.map((extra) => (
                          <div key={extra.id} className="flex justify-between text-xs">
                            <span style={{ color: 'var(--color-text-secondary)' }}>
                              {extra.extraName} × {extra.quantity}
                            </span>
                            <span style={{ color: 'var(--color-text-secondary)' }}>
                              {formatCurrency(Number(extra.subtotal))}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Acción: Cancelar */}
          {canCancel && (
            <button
              onClick={handleCancelClick}
              disabled={isCancelling}
              className="w-full px-4 py-3 rounded-lg font-semibold text-white transition disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-danger)' }}
            >
              {isCancelling ? 'Cancelando...' : 'Cancelar Orden'}
            </button>
          )}
        </div>
      </Drawer>

      <ConfirmDialog
        isOpen={confirmCancelOpen}
        title="Cancelar Orden"
        message={`¿Estás seguro de que deseas cancelar la orden #${order.orderNumber}? Esta acción no se puede deshacer.`}
        confirmText="Cancelar Orden"
        cancelText="Mantener Orden"
        isDangerous
        onConfirm={handleConfirmCancel}
        onCancel={() => setConfirmCancelOpen(false)}
      />
    </>
  );
}
