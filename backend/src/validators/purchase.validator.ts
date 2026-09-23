import { z } from 'zod';
import { paginationFields } from './pagination.validator';

const positiveDecimal = z
  .string()
  .or(z.number())
  .refine((v) => Number.isFinite(Number(v)) && Number(v) > 0, {
    message: 'Debe ser un número mayor a 0.',
  })
  .transform((v) => String(v));

const nonNegativeDecimal = z
  .string()
  .or(z.number())
  .refine((v) => Number.isFinite(Number(v)) && Number(v) >= 0, {
    message: 'Debe ser un número mayor o igual a 0.',
  })
  .transform((v) => String(v));

export const purchaseListSchema = z.object({
  ...paginationFields,
  status: z.enum(['draft', 'received']).optional(),
});

export const createPurchaseSchema = z.object({
  supplierId: z.string().uuid().optional(),
  supplierName: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      ingredientId: z.string().uuid(),
      quantity: positiveDecimal,
      unitCost: nonNegativeDecimal,
    })
  ).min(1, 'La compra debe tener al menos 1 item'),
});

export const updatePurchaseSchema = z.object({
  supplierId: z.string().uuid().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      ingredientId: z.string().uuid(),
      quantity: positiveDecimal,
      unitCost: nonNegativeDecimal,
    })
  ).optional(),
});
