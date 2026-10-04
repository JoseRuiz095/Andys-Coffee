import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PaginatedOrders } from '../types/orders.types';
import { getOrders, updateOrderStatus } from '../services/order.service';
import { OrderStatus } from '../types/backend.types';
import { sileo } from 'sileo';
import { invalidateMoneyAndStockQueries } from '../../../shared/utils/queryInvalidation';

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

  const statusMutation = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: OrderStatus }) => updateOrderStatus(id, newStatus),
    onSuccess: () => {
      void invalidateMoneyAndStockQueries(queryClient);
      sileo.success({ title: 'Estatus de orden actualizada correctamente' });
    },
    onError: () => {
      sileo.error({ title: 'Error', description: 'Error al actualizar el estatus de la orden' });
    },
  });

  return {
    orders: query.data?.data ?? [],
    pagination: query.data?.pagination,
    loading: query.isLoading,
    error: query.isError ? 'Error al obtener las órdenes, contacta al administrador' : null,
    setPage,
    setStatus,
    setSearch,
    updateStatus: (id: string, newStatus: OrderStatus) => {
      // One request at a time: a second click while the first is in flight would be rejected
      // by the server anyway (the transition is no longer valid).
      if (statusMutation.isPending) return;
      statusMutation.mutate({ id, newStatus });
    },
    /** Order whose status change is in flight (its buttons are disabled meanwhile). */
    updatingOrderId: statusMutation.isPending ? statusMutation.variables?.id ?? null : null,
  };
}

