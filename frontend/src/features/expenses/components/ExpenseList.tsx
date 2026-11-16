import { Spinner } from '../../../shared/components/Spinner';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { RowActions } from '../../../shared/components/RowActions';
import type { Expense } from '../types/expense.types';
import { useState } from 'react';
import { formatCurrency } from '../../../shared/utils/formatCurrency'
import { formatPaymentMethod } from '../../../shared/constants/paymentMethods'

interface ExpenseListProps {
  expenses: Expense[];
  loading: boolean;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => Promise<void>;
  isDeleting: boolean;
  /** expenses.update / expenses.delete: without them the row offers no action (the API answers 403). */
  canEdit: boolean;
  canDelete: boolean;
}

export function ExpenseList({ expenses, loading, onEdit, onDelete, isDeleting, canEdit, canDelete }: ExpenseListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (loading) {
    return <div className="flex justify-center py-8"><Spinner /></div>;
  }

  if (expenses.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
        No hay gastos registrados
      </div>
    );
  }

  const cannotEdit = (expense: Expense) => expense.cashSession?.status === 'closed';
  const hasActions = canEdit || canDelete;

  return (
    <>
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
        <table className="w-full text-sm" style={{ backgroundColor: 'var(--color-surface)' }}>
          <thead style={{ backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
            <tr>
              <th className="p-4 text-left font-semibold" style={{ color: 'var(--color-text-primary)' }}>Fecha</th>
              <th className="p-4 text-left font-semibold" style={{ color: 'var(--color-text-primary)' }}>Categoría</th>
              <th className="p-4 text-left font-semibold" style={{ color: 'var(--color-text-primary)' }}>Descripción</th>
              <th className="p-4 text-right font-semibold" style={{ color: 'var(--color-text-primary)' }}>Monto</th>
              <th className="p-4 text-center font-semibold" style={{ color: 'var(--color-text-primary)' }}>Método</th>
              <th className="p-4 text-center font-semibold" style={{ color: 'var(--color-text-primary)' }}>Sesión</th>
              {hasActions && <th className="p-4"><span className="sr-only">Acciones</span></th>}
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => {
              const isReadOnly = cannotEdit(expense);
              return (
                <tr
                  key={expense.id}
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                  }}
                >
                  <td className="p-4" style={{ color: 'var(--color-text-primary)' }}>
                    {new Date(expense.expenseDate).toLocaleDateString('es-MX')}
                  </td>
                  <td className="p-4" style={{ color: 'var(--color-text-primary)' }}>
                    {expense.category}
                  </td>
                  <td className="p-4" style={{ color: 'var(--color-text-primary)' }}>
                    {expense.description}
                  </td>
                  <td className="p-4 text-right" style={{ color: 'var(--color-text-primary)' }}>
                    {formatCurrency(Number(expense.amount))}
                  </td>
                  <td className="p-4 text-center" style={{ color: 'var(--color-text-primary)' }}>
                    {formatPaymentMethod(expense.paymentMethod)}
                  </td>
                  <td className="p-4 text-center">
                    {expense.cashSession ? (
                      <StatusBadge tone={expense.cashSession.status === 'open' ? 'success' : 'neutral'}>
                        {expense.cashSession.status === 'open' ? 'Abierta' : 'Cerrada'}
                      </StatusBadge>
                    ) : (
                      <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
                    )}
                  </td>
                  {hasActions && (
                    <td className="p-4">
                      {expense.sourceOrderId ? (
                        <span className="block text-right text-sm" style={{ color: 'var(--color-text-secondary)' }} title="Se corrige cancelando la venta que lo generó">
                          De una venta
                        </span>
                      ) : isReadOnly ? (
                        <span className="block text-right text-sm" style={{ color: 'var(--color-text-secondary)' }} title="El corte de caja de este gasto ya se cerró">
                          Sesión cerrada
                        </span>
                      ) : (
                        <RowActions
                          actions={[
                            ...(canEdit ? [{ label: 'Editar', onClick: () => onEdit(expense) }] : []),
                            ...(canDelete ? [{ label: 'Eliminar', onClick: () => setDeletingId(expense.id), danger: true }] : []),
                          ]}
                        />
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={!!deletingId}
        title="Eliminar gasto"
        message="¿Estás seguro de que deseas eliminar este gasto? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        isDangerous
        isLoading={isDeleting}
        onConfirm={async () => {
          if (deletingId) {
            await onDelete(deletingId);
            setDeletingId(null);
          }
        }}
        onCancel={() => setDeletingId(null)}
      />
    </>
  );
}
