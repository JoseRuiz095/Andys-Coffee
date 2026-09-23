import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Button } from '../../../shared/components/Button';
import type { Expense, CreateExpenseInput, UpdateExpenseInput, ExpenseCategory, ExpensePaymentMethod } from '../types/expense.types';
import { EXPENSE_CATEGORIES, EXPENSE_PAYMENT_METHODS } from '../types/expense.types';

interface ExpenseFormModalProps {
  isOpen: boolean;
  isLoading?: boolean;
  editingExpense?: Expense | null;
  onClose: () => void;
  onSubmit: (input: CreateExpenseInput | UpdateExpenseInput) => void;
}

export function ExpenseFormModal({ isOpen, isLoading = false, editingExpense, onClose, onSubmit }: ExpenseFormModalProps) {
  const [category, setCategory] = useState<ExpenseCategory | ''>(editingExpense?.category || '');
  const [description, setDescription] = useState(editingExpense?.description || '');
  const [amount, setAmount] = useState(editingExpense?.amount ? String(editingExpense.amount) : '');
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>(editingExpense?.paymentMethod || 'cash');
  const [expenseDate, setExpenseDate] = useState(editingExpense?.expenseDate?.split('T')[0] || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!category) newErrors.category = 'Selecciona una categoría';
    if (!description.trim()) newErrors.description = 'Ingresa una descripción';
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      newErrors.amount = 'Ingresa un monto válido (mayor a 0)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const input: CreateExpenseInput | UpdateExpenseInput = {
      ...(editingExpense && { id: editingExpense.id }),
      category: category as ExpenseCategory, // validateForm() rejects an empty category
      description: description.trim(),
      amount: parseFloat(amount),
      paymentMethod,
      ...(expenseDate && { expenseDate }),
    };

    onSubmit(input);
  };

  const handleClose = () => {
    setCategory('');
    setDescription('');
    setAmount('');
    setPaymentMethod('cash');
    setExpenseDate('');
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingExpense ? 'Editar gasto' : 'Nuevo gasto'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Categoría
            </label>
            <select
              value={category || ''}
              onChange={(e) => {
                setCategory(e.target.value as ExpenseCategory | '');
                if (errors.category) setErrors({ ...errors, category: '' });
              }}
              className="w-full px-3 py-2 border rounded-lg"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
            >
              <option value="">Selecciona una categoría</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {errors.category && <p style={{ color: 'var(--color-danger)' }} className="text-sm mt-1">{errors.category}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors({ ...errors, description: '' });
              }}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
              placeholder="Describe el gasto"
            />
            {errors.description && <p style={{ color: 'var(--color-danger)' }} className="text-sm mt-1">{errors.description}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Monto
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (errors.amount) setErrors({ ...errors, amount: '' });
                }}
                className="w-full px-3 py-2 border rounded-lg"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
                placeholder="0.00"
              />
              {errors.amount && <p style={{ color: 'var(--color-danger)' }} className="text-sm mt-1">{errors.amount}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Método de pago
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as ExpensePaymentMethod)}
                className="w-full px-3 py-2 border rounded-lg"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
              >
                {EXPENSE_PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method === 'cash' ? 'Efectivo' : method === 'transfer' ? 'Transferencia' : 'Tarjeta'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Fecha (opcional)
            </label>
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-input-bg)', color: 'var(--color-input-text)' }}
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={(e) => handleSubmit(e)} disabled={isLoading}>
            {isLoading ? 'Guardando...' : editingExpense ? 'Actualizar' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
