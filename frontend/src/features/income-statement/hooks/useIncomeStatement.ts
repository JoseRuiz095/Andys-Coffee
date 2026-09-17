import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IncomeStatementAPI, type DistributionSettings } from '../api/income-statement.api';

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
