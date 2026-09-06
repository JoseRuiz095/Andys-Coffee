import { z } from 'zod';
import { OrderStatus } from '@prisma/client';
import { normalizedSearchSchema, paginationFields } from './pagination.validator';

export const filterQuerySchema = z.strictObject({
  ...paginationFields,
  status: z.nativeEnum(OrderStatus).optional(),
  search: normalizedSearchSchema.optional(),
});

export const orderItemExtraSchema = z.strictObject({
  extraId: z.string().uuid(),
  quantity: z.number().positive().max(20),
});

export const orderItemSchema = z.strictObject({
  productId: z.string().uuid().optional(),
  comboId: z.string().uuid().optional(),
  quantity: z.number().int().positive().max(99),
  note: z.string().trim().max(500).optional().nullable(),
  extras: z.array(orderItemExtraSchema).max(20).optional(),
}).refine((item) => Boolean(item.productId) !== Boolean(item.comboId), {
  message: 'Cada item debe contener exactamente un productId o comboId.',
}).refine((item) => !item.comboId || !item.extras?.length, {
  message: 'Los extras solo pueden asociarse a productos.',
});

const paymentMethodSchema = z.enum([
  'Efectivo',
  'Transferencia',
  'Tarjeta',
  'cash',
  'transfer',
  'card',
]).transform((value) => ({
  Efectivo: 'cash',
  Transferencia: 'transfer',
  Tarjeta: 'card',
  cash: 'cash',
  transfer: 'transfer',
  card: 'card',
}[value]));

export const createOrderSchema = z.strictObject({
  customerName: z.string().trim().min(1).max(120).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  cashSessionId: z.string().uuid().optional(),
  cashReceived: z.number().finite().nonnegative().max(999999999.99).optional(),
  items: z.array(orderItemSchema).min(1, 'El pedido debe tener al menos un producto.').max(100),
  paymentMethod: paymentMethodSchema,
  // cashSessionId y createdById se obtendrán del request/sesión, no del body.
});

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
});