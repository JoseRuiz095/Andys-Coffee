import { Spinner } from '../../../shared/components/Spinner';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import type { Expense } from '../types/expense.types';
import { useState } from 'react';

interface ExpenseListProps {
  expenses: Expense[];
  loading: boolean;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
}

export function ExpenseList({ expenses, loading, onEdit, onDelete }: ExpenseListProps) {
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
              <th className="p-4 text-center font-semibold" style={{ color: 'var(--color-text-primary)' }}>Acciones</th>
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
                    {new Date(expense.expenseDate).toLocaleDateString('es-ES')}
                  </td>
                  <td className="p-4" style={{ color: 'var(--color-text-primary)' }}>
                    {expense.category}
                  </td>
                  <td className="p-4" style={{ color: 'var(--color-text-primary)' }}>
                    {expense.description}
                  </td>
                  <td className="p-4 text-right" style={{ color: 'var(--color-text-primary)' }}>
                    ${Number(expense.amount).toFixed(2)}
                  </td>
                  <td className="p-4 text-center" style={{ color: 'var(--color-text-primary)' }}>
                    {expense.paymentMethod === 'cash' ? 'Efectivo' : expense.paymentMethod === 'transfer' ? 'Transferencia' : 'Tarjeta'}
                  </td>
                  <td className="p-4 text-center">
                    {expense.cashSession ? (
                      <span
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{
                          backgroundColor: expense.cashSession.status === 'open' ? 'var(--color-surface-secondary)' : 'var(--color-surface-secondary)',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {expense.cashSession.status === 'open' ? 'Abierta' : 'Cerrada'}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
                    )}
                  </td>
                  <td className="p-4 text-center space-x-2">
                    <button
                      onClick={() => onEdit(expense)}
                      disabled={isReadOnly}
                      title={isReadOnly ? 'No se puede editar: sesión cerrada' : ''}
                      className="px-3 py-1 text-xs rounded hover:opacity-80 disabled:opacity-50"
                      style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-button-text)' }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setDeletingId(expense.id)}
                      disabled={isReadOnly}
                      title={isReadOnly ? 'No se puede eliminar: sesión cerrada' : ''}
                      className="px-3 py-1 text-xs rounded hover:opacity-80 disabled:opacity-50"
                      style={{ backgroundColor: 'var(--color-danger)', color: 'var(--color-button-text)' }}
                    >
                      Eliminar
                    </button>
                  </td>
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
        onConfirm={() => {
          if (deletingId) {
            onDelete(deletingId);
            setDeletingId(null);
          }
        }}
        onCancel={() => setDeletingId(null)}
      />
    </>
  );
}
