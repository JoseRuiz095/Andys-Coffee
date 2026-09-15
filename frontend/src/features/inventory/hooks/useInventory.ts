import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryApi } from '../api/inventory.api'

export function useInventorySummary() {
  return useQuery({
    queryKey: ['inventory', 'summary'],
    queryFn: () => inventoryApi.getSummary(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useInventoryValue() {
  return useQuery({
    queryKey: ['inventory', 'value'],
    queryFn: () => inventoryApi.getTotalValue(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useLowStock() {
  return useQuery({
    queryKey: ['inventory', 'low-stock'],
    queryFn: () => inventoryApi.getLowStock(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateIngredient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof inventoryApi.create>[0]) =>
      inventoryApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useUpdateIngredient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof inventoryApi.update>[1] }) =>
      inventoryApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useSetIngredientActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      inventoryApi.setActive(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useDeleteIngredient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      inventoryApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export interface UseInventoryListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'all' | 'normal' | 'low_stock' | 'out_of_stock';
  isActive?: boolean;
}

export function useInventoryList(params: UseInventoryListParams = {}) {
  return useQuery({
    queryKey: ['inventory', 'list', params],
    queryFn: () => inventoryApi.getAll(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useInventoryById(id: string) {
  return useQuery({
    queryKey: ['inventory', id],
    queryFn: () => inventoryApi.getById(id),
    enabled: !!id,
    staleTime: 3 * 60 * 1000,
  });
}

export function useInventoryBySku(sku: string) {
  return useQuery({
    queryKey: ['inventory', 'sku', sku],
    queryFn: () => inventoryApi.getBySku(sku),
    enabled: !!sku,
    staleTime: 3 * 60 * 1000,
  });
}

export interface UseInventoryMovementsParams {
  page?: number;
  limit?: number;
  ingredientId?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
}

export function useInventoryMovements(params: UseInventoryMovementsParams = {}) {
  return useQuery({
    queryKey: ['inventory', 'movements', params],
    queryFn: () => inventoryApi.getMovements(params),
    staleTime: 2 * 60 * 1000,
  });
}

export function useSearchIngredients(query: string) {
  return useQuery({
    queryKey: ['inventory', 'search', query],
    queryFn: () => inventoryApi.searchIngredients(query),
    enabled: query.length >= 2,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useInventoryUnits() {
  return useQuery({
    queryKey: ['inventory', 'units'],
    queryFn: () => inventoryApi.getUnits(),
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}
