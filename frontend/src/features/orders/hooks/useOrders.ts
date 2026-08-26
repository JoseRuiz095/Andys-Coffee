import { useState, useEffect } from 'react';
import { orders as mockOrders } from '../mocks/orders.mock';
import { Order } from '../types/orders.types';

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    // In a real application, you would fetch the data from an API
    // and then set up a WebSocket or SSE connection for real-time updates.
    setOrders(mockOrders);
  }, []);

  // This function would be called when a new order is received from the real-time connection.
  const addOrder = (newOrder: Order) => {
    setOrders((prevOrders) => [newOrder, ...prevOrders]);
    // Here you would also trigger the Sileo notification
  };

  return { orders, addOrder, setOrders };
}
