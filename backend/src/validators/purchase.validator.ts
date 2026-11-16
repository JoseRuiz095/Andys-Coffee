import { z } from 'zod';
import { paginationFields } from './pagination.validator';

// V3 (2026-11-14): bounded so quantity × cost fits the Decimal(14,2) line total (no 500s).
const MAX_QUANTITY = 100_000;
const MAX_UNIT_COST = 1_000_000;

const positiveDecimal = z
  .string()
  .or(z.number())
  .refine((v) => Number.isFinite(Number(v)) && Number(v) > 0 && Number(v) <= MAX_QUANTITY, {
    message: `Debe ser un número mayor a 0 y hasta ${MAX_QUANTITY.toLocaleString('es-MX')}.`,
  })
  .transform((v) => String(v));

const nonNegativeDecimal = z
  .string()
  .or(z.number())
  .refine((v) => Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= MAX_UNIT_COST, {
    message: `Debe ser un número entre 0 y ${MAX_UNIT_COST.toLocaleString('es-MX')}.`,
  })
  .transform((v) => String(v));

export const purchaseListSchema = z.object({
  ...paginationFields,
  status: z.enum(['draft', 'received']).optional(),
});

export const createPurchaseSchema = z.object({
  supplierId: z.string().uuid().optional(),
  supplierName: z.string().max(120).optional(),
  notes: z.string().max(1000).optional(),
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
