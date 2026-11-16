import { useState } from 'react';
import { useExpenses } from '../hooks/useExpenses';
import { ExpenseFormModal } from '../components/ExpenseFormModal';
import { ExpenseList } from '../components/ExpenseList';
import { ExpenseFilters } from '../components/ExpenseFilters';
import { Button } from '../../../shared/components/Button';
import { Pagination } from '../../../shared/components/Pagination';
import { PageHeader } from '../../../shared/components/PageHeader';
import { QueryErrorState } from '../../../shared/components/QueryErrorState';
import { useCurrentUser } from '../../auth/hooks/useCurrentUser';
import { hasPermission } from '../../auth/utils/permissions';
import type { Expense, CreateExpenseInput, UpdateExpenseInput, ExpenseCategory, ExpenseListFilters } from '../types/expense.types';

export function ExpensesPage() {
  // The list only needs expenses.read; creating, editing and deleting each have their permission.
  const currentUser = useCurrentUser();
  const canCreate = hasPermission(currentUser, 'expenses.create');
  const canEdit = hasPermission(currentUser, 'expenses.update');
  const canDelete = hasPermission(currentUser, 'expenses.delete');
  const [category, setCategory] = useState<ExpenseCategory | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [page, setPage] = useState(1);

  const filters: ExpenseListFilters = {
    page,
    category: category || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };

  const { expenses, pagination, loading, error, refetch, isFetching, create, update, deleteAsync, isCreating, isUpdating, isDeleting } = useExpenses(filters);

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
      update(input as UpdateExpenseInput, { onSuccess: handleCloseForm });
    } else {
      create(input as CreateExpenseInput, { onSuccess: handleCloseForm });
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await deleteAsync(id);
    } catch {
      // The hook already shows the error toast; the dialog just closes.
    }
  };

  // A different filter is a different list: start again from its first page.
  const withFirstPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const handleClearFilters = () => {
    setCategory('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gastos"
        description="Gastos operativos del negocio; los de un corte cerrado ya no se pueden modificar."
        actions={
          canCreate && (
            <Button onClick={handleOpenForm} disabled={isCreating || isUpdating || isDeleting}>
              Nuevo gasto
            </Button>
          )
        }
      />

      <ExpenseFilters
        category={category}
        startDate={startDate}
        endDate={endDate}
        onCategoryChange={withFirstPage(setCategory)}
        onStartDateChange={withFirstPage(setStartDate)}
        onEndDateChange={withFirstPage(setEndDate)}
        onClear={handleClearFilters}
      />

      {error ? (
        <QueryErrorState error={error} subject="los gastos" onRetry={() => void refetch()} isRetrying={isFetching} />
      ) : (
        <ExpenseList
          expenses={expenses}
          loading={loading}
          onEdit={handleEditExpense}
          onDelete={handleDeleteExpense}
          isDeleting={isDeleting}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}

      {pagination && !error && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          pageSize={pagination.limit}
          itemLabel="gastos"
          onPageChange={setPage}
          disabled={loading}
        />
      )}

      {/* Mounted per opening (keyed by the expense) so its fields always start from that
          expense, or empty for a new one. */}
      {isFormOpen && (
        <ExpenseFormModal
          key={editingExpense?.id ?? 'new'}
          isOpen
          isLoading={isCreating || isUpdating}
          editingExpense={editingExpense}
          onClose={handleCloseForm}
          onSubmit={handleSubmitForm}
        />
      )}
    </div>
  );
}
