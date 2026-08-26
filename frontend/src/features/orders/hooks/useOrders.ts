import { useState, useEffect } from 'react';
import { PaginatedOrders } from '../types/orders.types';
import { getOrders, updateOrderStatus } from '../services/order.service';
import { OrderStatus } from '../types/backend.types';
import { sileo } from 'sileo';

export function useOrders() {
  const [data, setData] = useState<PaginatedOrders | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getOrders(page, limit, status, search);
        setData(result);
      } catch {
        const errorMessage = 'Error al obtener las órdenes, contacta al administrador';
        setError(errorMessage);
        sileo.error({ title: 'Error', description: errorMessage });
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [page, limit, status, search]);

  const handleUpdateStatus = async (id: string, newStatus: OrderStatus) => {
    try {
      const updatedOrder = await updateOrderStatus(id, newStatus);
      setData(prevData => {
        if (!prevData) return null;
        const newOrders = prevData.data.map(order =>
          order.id === id ? { ...order, ...updatedOrder } : order
        );
        sileo.success({ title: 'Estatus de orden actualizada correctamente' });
        return { ...prevData, data: newOrders };
      });
    } catch {
      const errorMessage = 'Error al actualizar el estatus de la orden';
      setError(errorMessage);
      sileo.error({ title: 'Error', description: errorMessage });
    }
  };

  return {
    orders: data?.data ?? [],
    pagination: data?.pagination,
    loading,
    error,
    setPage,
    setStatus,
    setSearch,
    updateStatus: handleUpdateStatus,
  };
}

