export const EXPENSE_CATEGORIES = ['insumos', 'servicios', 'mantenimiento', 'nomina', 'renta', 'otros'] as const;
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

export const EXPENSE_PAYMENT_METHODS = ['cash', 'transfer', 'card'] as const;
export type ExpensePaymentMethod = typeof EXPENSE_PAYMENT_METHODS[number];

export interface Expense {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number | string;
  paymentMethod: ExpensePaymentMethod;
  expenseDate: string;
  cashSessionId: string | null;
  cashSession?: { id: string; status: string } | null;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
}

export interface CreateExpenseInput {
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentMethod: ExpensePaymentMethod;
  expenseDate?: string;
}

export type UpdateExpenseInput = Partial<CreateExpenseInput> & { id: string };

export interface ExpenseListFilters {
  page?: number;
  limit?: number;
  category?: ExpenseCategory;
  startDate?: string;
  endDate?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
