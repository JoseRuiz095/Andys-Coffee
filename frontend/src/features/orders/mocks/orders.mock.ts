import { Order } from '../types/orders.types';

export const orders: Order[] = [
  {
    id: '1',
    orderNumber: 351,
    createdAt: '2026-08-25T13:32:00Z',
    status: 'PENDING',
    items: [
      {
        id: '1',
        productId: '1',
        productName: 'Bagel de Pollo',
        quantity: 1,
        extras: ['Queso', 'Extra aguacate'],
        image: 'https://via.placeholder.com/150',
      },
      {
        id: '2',
        productId: '2',
        productName: 'Latte',
        quantity: 2,
        extras: ['Leche deslactosada'],
        image: 'https://via.placeholder.com/150',
      },
      {
        id: '3',
        productId: '3',
        productName: 'Bagel de Carne',
        quantity: 1,
        extras: [],
        notes: 'Sin cebolla',
        image: 'https://via.placeholder.com/150',
      },
    ],
  },
  {
    id: '2',
    orderNumber: 352,
    createdAt: '2026-08-25T13:35:00Z',
    status: 'PREPARING',
    items: [
      {
        id: '4',
        productId: '4',
        productName: 'Cappuccino',
        quantity: 1,
        extras: [],
        image: 'https://via.placeholder.com/150',
      },
    ],
  },
  {
    id: '3',
    orderNumber: 350,
    createdAt: '2026-08-25T13:30:00Z',
    status: 'READY',
    items: [
      {
        id: '5',
        productId: '5',
        productName: 'Croissant',
        quantity: 2,
        extras: [],
        image: 'https://via.placeholder.com/150',
      },
    ],
  },
    {
    id: '4',
    orderNumber: 349,
    createdAt: '2026-08-25T13:28:00Z',
    status: 'COMPLETED',
    items: [
      {
        id: '6',
        productId: '6',
        productName: 'Jugo de Naranja',
        quantity: 1,
        extras: [],
        image: 'https://via.placeholder.com/150',
      },
    ],
  },
  {
    id: '5',
    orderNumber: 346,
    createdAt: '2026-08-25T13:25:00Z',
    status: 'REJECTED',
    items: [
      {
        id: '7',
        productId: '7',
        productName: 'Té Verde',
        quantity: 1,
        extras: [],
        image: 'https://via.placeholder.com/150',
      },
    ],
  },
];
