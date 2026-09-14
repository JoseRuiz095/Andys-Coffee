import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryExitsApi } from '../api/inventory-exits.api';
import type { CreateExitPayload } from '../api/inventory-exits.api';

export function useCreateExit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateExitPayload) => inventoryExitsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
