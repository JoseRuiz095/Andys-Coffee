import { z } from 'zod';

export const orderItemExtraSchema = z.object({
  extraId: z.string().uuid(),
  quantity: z.number().positive(),
});

export const orderItemSchema = z.object({
  productId: z.string().uuid().optional(),
  comboId: z.string().uuid().optional(),
  quantity: z.number().positive(),
  notes: z.string().optional().nullable(),
  extras: z.array(orderItemExtraSchema).optional(),
});

export const createOrderSchema = z.object({
  customerName: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(orderItemSchema).min(1, 'El pedido debe tener al menos un producto.'),
  // cashSessionId y createdById se obtendrán del request/sesión, no del body.
});