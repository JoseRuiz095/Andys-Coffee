import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IncomeStatementAPI, type DistributionSettings, type FixedExpenseSettings } from '../api/income-statement.api';

const QUERY_KEY = 'incomeStatement';

export function useIncomeStatementDay(date: string, cashRegisterId?: string, enabled = true) {
  return useQuery({
    queryKey: [QUERY_KEY, 'day', date, cashRegisterId],
    queryFn: () => IncomeStatementAPI.getDay({ date, cashRegisterId }),
    enabled: enabled && Boolean(date),
  });
}

export function useIncomeStatementDayDetail(date: string | null, cashRegisterId?: string) {
  return useQuery({
    queryKey: [QUERY_KEY, 'day-detail', date, cashRegisterId],
    queryFn: () => IncomeStatementAPI.getDayDetail({ date: date as string, cashRegisterId }),
    enabled: Boolean(date),
  });
}

export function useIncomeStatementWeek(date: string, cashRegisterId?: string, enabled = true) {
  return useQuery({
    queryKey: [QUERY_KEY, 'week', date, cashRegisterId],
    queryFn: () => IncomeStatementAPI.getWeek({ date, cashRegisterId }),
    enabled: enabled && Boolean(date),
  });
}

export function useIncomeStatementMonth(month: string, cashRegisterId?: string, enabled = true) {
  return useQuery({
    queryKey: [QUERY_KEY, 'month', month, cashRegisterId],
    queryFn: () => IncomeStatementAPI.getMonth({ month, cashRegisterId }),
    enabled: enabled && Boolean(month),
  });
}

export function useIncomeStatementRange(from: string, to: string, cashRegisterId?: string, enabled = true) {
  return useQuery({
    queryKey: [QUERY_KEY, 'range', from, to, cashRegisterId],
    queryFn: () => IncomeStatementAPI.getRange({ from, to, cashRegisterId }),
    enabled: enabled && Boolean(from) && Boolean(to) && from <= to,
  });
}

export function useDistributionSettings() {
  return useQuery({
    queryKey: [QUERY_KEY, 'distribution-settings'],
    queryFn: () => IncomeStatementAPI.getDistributionSettings(),
  });
}

export function useUpdateDistributionSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DistributionSettings) => IncomeStatementAPI.updateDistributionSettings(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useFixedExpenseSettings() {
  return useQuery({
    queryKey: [QUERY_KEY, 'fixed-expense-settings'],
    queryFn: () => IncomeStatementAPI.getFixedExpenseSettings(),
  });
}

export function useUpsertFixedExpenseConcept() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, input }: { slug: string; input: { label: string; amount: number } }) =>
      IncomeStatementAPI.upsertFixedExpenseConcept(slug, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useDeleteFixedExpenseConcept() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => IncomeStatementAPI.deleteFixedExpenseConcept(slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useUpdateAccumulatedBalances() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      date,
      input,
    }: {
      date: string;
      input: { ahorroAcumulado: number; fondoNegocioAcumulado: number; surtidoAcumulado: number };
    }) => IncomeStatementAPI.updateAccumulatedBalances(date, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
