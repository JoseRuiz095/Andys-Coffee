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
  'Pago Pendiente',
  'cash',
  'transfer',
  'card',
  'pending',
]).transform((value) => ({
  Efectivo: 'cash',
  Transferencia: 'transfer',
  Tarjeta: 'card',
  'Pago Pendiente': 'pending',
  cash: 'cash',
  transfer: 'transfer',
  card: 'card',
  pending: 'pending',
}[value]));

export const settlePaymentSchema = z.strictObject({
  method: z.enum(['cash', 'transfer']),
});

export const deliveryResponsibleSchema = z.enum(['customer_to_courier', 'customer_to_business', 'business_absorbs']);

export const deliveryHandoffSchema = z.strictObject({});

export const createOrderSchema = z.strictObject({
  customerName: z.string().trim().min(1).max(120).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  cashSessionId: z.string().uuid().optional(),
  cashReceived: z.number().finite().nonnegative().max(999999999.99).optional(),
  items: z.array(orderItemSchema).min(1, 'El pedido debe tener al menos un producto.').max(100),
  paymentMethod: paymentMethodSchema,
  hasDelivery: z.boolean().optional(),
  deliveryAmount: z.number().finite().nonnegative().max(999999.99).optional(),
  deliveryResponsible: deliveryResponsibleSchema.optional(),
  deliveryPaymentMethod: z.enum(['cash', 'transfer']).optional(),
  // cashSessionId y createdById se obtendrán del request/sesión, no del body.
}).refine((data) => data.paymentMethod !== 'pending' || Boolean(data.customerName?.trim()), {
  message: 'Se requiere el nombre del cliente para registrar un pago pendiente.',
  path: ['customerName'],
}).refine((data) => !data.hasDelivery || (data.deliveryAmount !== undefined && data.deliveryAmount > 0), {
  message: 'El costo del mandadito es requerido y debe ser mayor a 0.',
  path: ['deliveryAmount'],
}).refine((data) => !data.hasDelivery || Boolean(data.deliveryResponsible), {
  message: 'Debes indicar quién recibe/paga el mandadito.',
  path: ['deliveryResponsible'],
}).refine((data) => data.deliveryResponsible !== 'customer_to_business' || Boolean(data.deliveryPaymentMethod), {
  message: 'Debes indicar el método de pago del mandadito.',
  path: ['deliveryPaymentMethod'],
});

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  reason: z.string().trim().min(1).max(500).optional(),
});

export const updateOrderSchema = z.strictObject({
  customerName: z.string().trim().min(1).max(120).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
}).refine((data) => data.customerName !== undefined || data.notes !== undefined, {
  message: 'Debes indicar al menos un campo a editar.',
});

export const orderByDateQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD).'),
});