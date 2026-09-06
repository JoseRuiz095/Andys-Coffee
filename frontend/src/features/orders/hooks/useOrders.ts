import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PaginatedOrders } from '../types/orders.types';
import { getOrders, updateOrderStatus } from '../services/order.service';
import { OrderStatus } from '../types/backend.types';
import { sileo } from 'sileo';

export function useOrders() {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const query = useQuery<PaginatedOrders, Error>({
    queryKey: ['orders', { page, limit, status, search }],
    queryFn: () => getOrders(page, limit, status, search),
    placeholderData: (previous) => previous,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: OrderStatus }) => updateOrderStatus(id, newStatus),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
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
    updateStatus: (id: string, newStatus: OrderStatus) => statusMutation.mutate({ id, newStatus }),
  };
}

