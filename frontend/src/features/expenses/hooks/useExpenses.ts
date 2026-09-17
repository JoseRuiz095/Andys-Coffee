import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sileo } from 'sileo';
import { ExpenseAPI } from '../api/expense.api';
import type { CreateExpenseInput, UpdateExpenseInput, ExpenseListFilters } from '../types/expense.types';

export function useExpenses(filters: ExpenseListFilters = {}) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['expenses', filters],
    queryFn: () => ExpenseAPI.getAll(filters),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateExpenseInput) => ExpenseAPI.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      sileo.success({ title: 'Gasto registrado', description: 'El gasto se registró correctamente.' });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'No se pudo registrar el gasto.';
      sileo.error({ title: 'Error', description: message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: UpdateExpenseInput) => ExpenseAPI.update(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      sileo.success({ title: 'Gasto actualizado', description: 'El gasto se actualizó correctamente.' });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'No se pudo actualizar el gasto.';
      sileo.error({ title: 'Error', description: message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ExpenseAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      sileo.success({ title: 'Gasto eliminado', description: 'El gasto se eliminó correctamente.' });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'No se pudo eliminar el gasto.';
      sileo.error({ title: 'Error', description: message });
    },
  });

  return {
    expenses: data?.data ?? [],
    pagination: data?.pagination,
    loading: isLoading,
    error,
    create: createMutation.mutate,
    update: updateMutation.mutate,
    delete: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
