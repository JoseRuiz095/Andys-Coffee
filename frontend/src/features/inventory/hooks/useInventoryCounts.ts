import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { InventoryCountAPI } from '../api/inventory-count.api';
import { invalidateMoneyAndStockQueries } from '../../../shared/utils/queryInvalidation';

const QUERY_KEY = 'inventory-counts';

export interface UseCountsListParams {
  page?: number;
  limit?: number;
  status?: string;
  date?: string;
}

export const useCountsList = (params: UseCountsListParams = {}) => {
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
      // The adjustments change stock everywhere it is shown (lists, low stock, replenishment,
      // value) and the inventory losses of the day.
      void invalidateMoneyAndStockQueries(queryClient);
    },
  });
};

export const useRemoveItem = (countId: string | null) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ingredientId: string) => InventoryCountAPI.removeItem(countId!, ingredientId),
    onSuccess: () => {
      if (countId) {
        queryClient.invalidateQueries({
          queryKey: [QUERY_KEY, countId],
        });
      }
    },
  });
};

export const useDeleteCount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (countId: string) => InventoryCountAPI.deleteCount(countId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'list'] });
    },
  });
};
