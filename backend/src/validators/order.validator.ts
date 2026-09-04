import { z } from 'zod';
import { OrderStatus } from '@prisma/client';

export const filterQuerySchema = z.object({
  page: z.string().default('1'),
  limit: z.string().default('10'),
  status: z.nativeEnum(OrderStatus).optional(),
  search: z.string().optional(),
});

export const orderItemExtraSchema = z.object({
  extraId: z.string().uuid(),
  quantity: z.number().positive().max(20),
});

export const orderItemSchema = z.object({
  productId: z.string().uuid().optional(),
  comboId: z.string().uuid().optional(),
  quantity: z.number().int().positive().max(99),
  note: z.string().optional().nullable(),
  extras: z.array(orderItemExtraSchema).optional(),
}).refine((item) => Boolean(item.productId) !== Boolean(item.comboId), {
  message: 'Cada item debe contener exactamente un productId o comboId.',
});

export const createOrderSchema = z.object({
  customerName: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  cashSessionId: z.string().uuid().optional(),
  items: z.array(orderItemSchema).min(1, 'El pedido debe tener al menos un producto.'),
  paymentMethod: z.enum(['Efectivo', 'Transferencia', 'Tarjeta', 'cash', 'transfer', 'card']),
  // cashSessionId y createdById se obtendrán del request/sesión, no del body.
});

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
});