import { z } from 'zod';

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