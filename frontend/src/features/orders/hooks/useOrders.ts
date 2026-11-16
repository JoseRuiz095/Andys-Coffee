import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PaginatedOrders } from '../types/orders.types';
import { getOrders, updateOrderStatus } from '../services/order.service';
import { OrderStatus } from '../types/backend.types';
import { sileo } from 'sileo';
import { invalidateMoneyAndStockQueries } from '../../../shared/utils/queryInvalidation';
import { getErrorMessage } from '../../../shared/utils/errors';

export function useOrders() {
  const [page, setPage] = useState(1);
  // The board has no pagination: ask for the API maximum so an active order is not
  // pushed out of view by newer ones.
  const [limit] = useState(100);
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const query = useQuery<PaginatedOrders, Error>({
    queryKey: ['orders', { page, limit, status, search }],
    queryFn: () => getOrders(page, limit, status, search),
    placeholderData: (previous) => previous,
    // Orders are created from the POS on other devices: poll so they show up on the board.
    refetchInterval: 15_000,
  });

  // Orders whose status change is in flight. Several orders can change at once (a rush on the
  // board): only a second click on the same order is ignored.
  const [updatingIds, setUpdatingIds] = useState<ReadonlySet<string>>(() => new Set());
  const statusMutation = useMutation({
    mutationFn: ({ id, newStatus, reason }: { id: string; newStatus: OrderStatus; reason?: string }) =>
      updateOrderStatus(id, newStatus, reason),
    onMutate: ({ id }) => {
      setUpdatingIds((current) => new Set(current).add(id));
    },
    onSettled: (_data, _error, { id }) => {
      setUpdatingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    },
    onSuccess: () => {
      void invalidateMoneyAndStockQueries(queryClient);
      sileo.success({ title: 'Estatus de orden actualizada correctamente' });
    },
    onError: (error: unknown) => {
      // The server explains why (invalid transition, cash closed, missing permission...).
      sileo.error({ title: 'Error', description: getErrorMessage(error, 'Error al actualizar el estatus de la orden') });
    },
  });

  return {
    orders: query.data?.data ?? [],
    pagination: query.data?.pagination,
    loading: query.isLoading,
    // The raw error: the page shows the server's message and a retry.
    error: query.isError ? query.error : null,
    refetch: query.refetch,
    isFetching: query.isFetching,
    setPage,
    setStatus,
    setSearch,
    updateStatus: (id: string, newStatus: OrderStatus, options?: { reason?: string; onSuccess?: () => void }) => {
      // A second click on the same order while its change is in flight would be rejected by the
      // server anyway (the transition is no longer valid).
      if (updatingIds.has(id)) return;
      statusMutation.mutate({ id, newStatus, reason: options?.reason }, { onSuccess: options?.onSuccess });
    },
    /** Whether this order's status change is in flight (its buttons are disabled meanwhile). */
    isUpdatingOrder: (id: string) => updatingIds.has(id),
  };
}

