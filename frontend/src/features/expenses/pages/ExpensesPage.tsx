import { useState } from 'react';
import { useExpenses } from '../hooks/useExpenses';
import { ExpenseFormModal } from '../components/ExpenseFormModal';
import { ExpenseList } from '../components/ExpenseList';
import { ExpenseFilters } from '../components/ExpenseFilters';
import { Button } from '../../../shared/components/Button';
import type { Expense, CreateExpenseInput, UpdateExpenseInput, ExpenseCategory, ExpenseListFilters } from '../types/expense.types';

export function ExpensesPage() {
  const [category, setCategory] = useState<ExpenseCategory | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const filters: ExpenseListFilters = {
    category: category || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };

  const { expenses, pagination, loading, create, update, delete: deleteExpense, isCreating, isUpdating, isDeleting } = useExpenses(filters);

  const handleOpenForm = () => {
    setEditingExpense(null);
    setIsFormOpen(true);
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingExpense(null);
  };

  const handleSubmitForm = (input: CreateExpenseInput | UpdateExpenseInput) => {
    if (editingExpense && 'id' in input) {
      update(input as UpdateExpenseInput);
    } else {
      create(input as CreateExpenseInput);
    }
    handleCloseForm();
  };

  const handleDeleteExpense = (id: string) => {
    deleteExpense(id);
  };

  const handleClearFilters = () => {
    setCategory('');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Gastos
        </h1>
        <Button onClick={handleOpenForm} disabled={isCreating || isUpdating || isDeleting}>
          Nuevo gasto
        </Button>
      </div>

      <ExpenseFilters
        category={category}
        startDate={startDate}
        endDate={endDate}
        onCategoryChange={setCategory}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onClear={handleClearFilters}
      />

      <ExpenseList
        expenses={expenses}
        loading={loading}
        onEdit={handleEditExpense}
        onDelete={handleDeleteExpense}
      />

      {pagination && (
        <div className="flex items-center justify-between text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          <span>
            Total: {pagination.total} gastos
          </span>
          <span>
            Página {pagination.page} de {pagination.totalPages}
          </span>
        </div>
      )}

      <ExpenseFormModal
        isOpen={isFormOpen}
        isLoading={isCreating || isUpdating}
        editingExpense={editingExpense}
        onClose={handleCloseForm}
        onSubmit={handleSubmitForm}
      />
    </div>
  );
}
