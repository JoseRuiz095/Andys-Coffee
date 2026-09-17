import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { purchasesApi } from '../api/purchases.api'

export interface UsePurchasesParams {
  page?: number;
  limit?: number;
  status?: string;
}

export function usePurchasesList(params: UsePurchasesParams = {}) {
  return useQuery({
    queryKey: ['purchases', 'list', params],
    queryFn: () => purchasesApi.getAll(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function usePurchaseById(id: string) {
  return useQuery({
    queryKey: ['purchases', id],
    queryFn: () => purchasesApi.getById(id),
    enabled: !!id,
    staleTime: 3 * 60 * 1000,
  });
}

export function useReceivePurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (purchaseId: string) => purchasesApi.receivePurchase(purchaseId),
    onSuccess: (data) => {
      // Invalidate purchases list to refetch
      queryClient.invalidateQueries({ queryKey: ['purchases'] });

      // Invalidate inventory queries since stock was updated
      queryClient.invalidateQueries({ queryKey: ['inventory'] });

      // Invalidate dashboard since inventory changed
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      // Update this specific purchase in cache
      queryClient.setQueryData(['purchases', data.purchase.id], data.purchase);
    },
  });
}

export function useDraftPurchases() {
  return useQuery({
    queryKey: ['purchases', 'draft'],
    queryFn: () => purchasesApi.getAll({ status: 'draft', limit: 100 }),
    staleTime: 2 * 60 * 1000,
  });
}

export function useReceivedPurchases() {
  return useQuery({
    queryKey: ['purchases', 'received'],
    queryFn: () => purchasesApi.getAll({ status: 'received', limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDeletePurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => purchasesApi.deletePurchase(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCreatePurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof purchasesApi.create>[0]) =>
      purchasesApi.create(data),
    onSuccess: (data) => {
      // Invalidate purchases list to refetch
      queryClient.invalidateQueries({ queryKey: ['purchases'] });

      // Add new purchase to cache
      queryClient.setQueryData(['purchases', data.purchase.id], data.purchase);
    },
  });
}

export function useSupplierById(id: string) {
  return useQuery({
    queryKey: ['suppliers', id],
    queryFn: () => purchasesApi.getSupplier(id),
    enabled: !!id,
    staleTime: 3 * 60 * 1000,
  });
}

export interface UseSuppliersListParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export function useSuppliersList(params: UseSuppliersListParams = {}) {
  return useQuery({
    queryKey: ['suppliers', 'list', params],
    queryFn: () => purchasesApi.getSuppliers(params),
    staleTime: 2 * 60 * 1000,
  });
}

export function useSearchSuppliers(query: string) {
  return useQuery({
    queryKey: ['suppliers', 'search', query],
    queryFn: () => purchasesApi.searchSuppliers(query),
    enabled: query.length >= 2,
    staleTime: 30 * 1000,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof purchasesApi.createSupplier>[0]) =>
      purchasesApi.createSupplier(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.setQueryData(['suppliers', data.supplier.id], data.supplier);
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof purchasesApi.updateSupplier>[1] }) =>
      purchasesApi.updateSupplier(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.setQueryData(['suppliers', data.supplier.id], data.supplier);
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      purchasesApi.deleteSupplier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

export function useSetSupplierActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      purchasesApi.setSupplierActive(id, isActive),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.setQueryData(['suppliers', data.supplier.id], data.supplier);
    },
  });
}
