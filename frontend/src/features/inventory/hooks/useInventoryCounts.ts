import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { InventoryCountAPI } from '../api/inventory-count.api';

const QUERY_KEY = 'inventory-counts';

export const useCountsList = (params: { page?: number; limit?: number } = {}) => {
  return useQuery({
    queryKey: [QUERY_KEY, 'list', params],
    queryFn: () => InventoryCountAPI.getAll(params),
    staleTime: 2 * 60 * 1000,
  });
};

export const useCreateCount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => InventoryCountAPI.createCount(),
    onSuccess: (data) => {
      queryClient.setQueryData([QUERY_KEY, data.id], data);
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'list'] });
    },
  });
};

export const useGetCount = (countId: string | null) => {
  return useQuery({
    queryKey: [QUERY_KEY, countId],
    queryFn: () => InventoryCountAPI.getCount(countId!),
    enabled: !!countId,
  });
};

export const useAddItem = (countId: string | null) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      ingredientId: string;
      countedQuantity: number;
      notes?: string;
    }) =>
      InventoryCountAPI.addItem(
        countId!,
        data.ingredientId,
        data.countedQuantity,
        data.notes,
      ),
    onSuccess: () => {
      if (countId) {
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEY, countId],
        });
      }
    },
  });
};

export const useCompleteCount = (countId: string | null) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => InventoryCountAPI.completeCount(countId!),
    onSuccess: () => {
      if (countId) {
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEY, countId],
        });
      }
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'list'] });
    },
  });
};

export const useApplyAdjustments = (countId: string | null) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => InventoryCountAPI.applyAdjustments(countId!),
    onSuccess: () => {
      if (countId) {
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEY, countId],
        });
      }
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'list'] });
      queryClient.invalidateQueries({
        queryKey: ['inventory', 'summary'],
      });
      queryClient.invalidateQueries({
        queryKey: ['inventory', 'movements'],
      });
    },
  });
};
