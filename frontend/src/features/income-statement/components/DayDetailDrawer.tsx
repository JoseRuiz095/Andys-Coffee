import { createPortal } from 'react-dom';
import { useIncomeStatementDayDetail } from '../hooks/useIncomeStatement';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import { CashStatusBadge } from './CashStatusBadge';

interface DayDetailDrawerProps {
  date: string | null;
  cashRegisterId?: string;
  onClose: () => void;
}

export function DayDetailDrawer({ date, cashRegisterId, onClose }: DayDetailDrawerProps) {
  const { data, isLoading, error } = useIncomeStatementDayDetail(date, cashRegisterId);

  if (!date) return null;

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl shadow-lg"
        style={{ backgroundColor: 'var(--color-surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sticky top-0 flex items-center justify-between border-b px-6 py-4"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Detalle del {date}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Cerrar ✕
          </button>
        </div>

        <div className="space-y-6 p-6">
          {isLoading && <p style={{ color: 'var(--color-text-secondary)' }}>Cargando detalle…</p>}
          {error && <p style={{ color: 'var(--color-danger)' }}>Error al cargar el detalle del día.</p>}

          {data && (
            <>
              <section>
                <h3 className="mb-2 text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  Ingresos por método de pago
                </h3>
                {data.paymentsBreakdown.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Sin ventas registradas.</p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {data.paymentsBreakdown.map((p) => (
                        <tr key={p.method} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                          <td className="py-2" style={{ color: 'var(--color-text-primary)' }}>{p.method}</td>
                          <td className="py-2 text-right" style={{ color: 'var(--color-text-secondary)' }}>{p.count} pagos</td>
                          <td className="py-2 text-right font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            {formatCurrency(p.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  Sesiones de caja
                </h3>
                {data.sessions.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No hubo sesiones este día.</p>
                ) : (
                  <div className="space-y-3">
                    {data.sessions.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-xl border p-3 text-sm"
                        style={{ borderColor: 'var(--color-border)' }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            {s.cashRegisterName}
                          </span>
                          <CashStatusBadge status={s.cashStatus} />
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                          <span>Abierta por {s.openedByName}</span>
                          <span className="text-right">Fondo inicial: {formatCurrency(s.openingAmount)}</span>
                          <span>Esperado: {formatCurrency(s.expectedAmount)}</span>
                          <span className="text-right">
                            Real: {s.closingAmount === null ? '—' : formatCurrency(s.closingAmount)}
                          </span>
                        </div>
                        {s.closingReason && (
                          <p className="mt-2 text-xs italic" style={{ color: 'var(--color-text-secondary)' }}>
                            Motivo: {s.closingReason}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  Gastos
                </h3>
                {data.expenses.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Sin gastos registrados.</p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {data.expenses.map((e) => (
                        <tr key={e.id} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                          <td className="py-2" style={{ color: 'var(--color-text-primary)' }}>
                            {e.description}
                            <span className="ml-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                              ({e.category} · {e.paymentMethod})
                            </span>
                          </td>
                          <td className="py-2 text-right font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            {formatCurrency(e.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const portalRoot = document.getElementById('modal-root');
  return portalRoot ? createPortal(content, portalRoot) : content;
}
