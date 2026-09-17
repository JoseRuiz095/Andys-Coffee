import { apiClient } from '../../../app/api';
import type { Expense, CreateExpenseInput, UpdateExpenseInput, ExpenseListFilters, PaginationMeta } from '../types/expense.types';

const BASE_URL = '/expenses';

export const ExpenseAPI = {
  async getAll(filters: ExpenseListFilters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.set(key, String(value));
    });
    const { data } = await apiClient.get<{ data: Expense[]; pagination: PaginationMeta }>(
      `${BASE_URL}${params.toString() ? `?${params.toString()}` : ''}`
    );
    return data;
  },

  async getById(id: string) {
    const { data } = await apiClient.get<{ expense: Expense }>(`${BASE_URL}/${id}`);
    return data.expense;
  },

  async create(input: CreateExpenseInput) {
    const { data } = await apiClient.post<{ expense: Expense }>(BASE_URL, input);
    return data.expense;
  },

  async update(input: UpdateExpenseInput) {
    const { id, ...payload } = input;
    const { data } = await apiClient.patch<{ expense: Expense }>(`${BASE_URL}/${id}`, payload);
    return data.expense;
  },

  async delete(id: string) {
    await apiClient.delete(`${BASE_URL}/${id}`);
  },
};
