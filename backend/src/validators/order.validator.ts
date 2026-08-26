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
  quantity: z.number().positive(),
});

export const orderItemSchema = z.object({
  productId: z.string().optional(),
  comboId: z.string().optional(),
  quantity: z.number().positive(),
  note: z.string().optional().nullable(),
  unitPrice: z.number(),
  extras: z.array(orderItemExtraSchema).optional(),
});

export const createOrderSchema = z.object({
  customerName: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(orderItemSchema).min(1, 'El pedido debe tener al menos un producto.'),
  paymentMethod: z.string(),
  // cashSessionId y createdById se obtendrán del request/sesión, no del body.
});

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
});