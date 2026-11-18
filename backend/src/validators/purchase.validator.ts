import { z } from 'zod';
import { paginationFields } from './pagination.validator';
import { decimalInput } from './common.validator';

// Quantities arrive in the ingredient's BASE unit (the form converts kg → gr and lt → ml), so the
// cap is 10,000,000 base units (10 t / 10,000 lt). It used to be 100,000, which blocked any line
// over 100 kg or 100 lt (QA audit 2026-11-18, D-09). The line and purchase caps keep totals inside
// Decimal(14,2) per line and Decimal(12,2) per purchase (V3, 2026-11-14: no 500s on overflow).
export const MAX_PURCHASE_QUANTITY = 10_000_000;
const MAX_UNIT_COST = 1_000_000;
const MAX_LINE_TOTAL = 100_000_000;
const MAX_PURCHASE_TOTAL = 1_000_000_000;
const mx = (value: number) => value.toLocaleString('es-MX');

const positiveDecimal = decimalInput({
  exclusiveMin: true,
  max: MAX_PURCHASE_QUANTITY,
  message: `La cantidad debe ser un número mayor a 0 y hasta ${mx(MAX_PURCHASE_QUANTITY)} (en la unidad base del insumo).`,
});

const nonNegativeDecimal = decimalInput({
  max: MAX_UNIT_COST,
  message: `El costo unitario debe ser un número entre 0 y ${mx(MAX_UNIT_COST)}.`,
});

const purchaseItemSchema = z.object({
  ingredientId: z.string().uuid(),
  quantity: positiveDecimal,
  unitCost: nonNegativeDecimal,
}).refine((item) => Number(item.quantity) * Number(item.unitCost) <= MAX_LINE_TOTAL, {
  message: `El total de un renglón no puede superar $${mx(MAX_LINE_TOTAL)}.`,
});

const purchaseItemsSchema = z.array(purchaseItemSchema)
  .min(1, 'La compra debe tener al menos 1 insumo.')
  .refine(
    (items) => items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitCost), 0) <= MAX_PURCHASE_TOTAL,
    `El total de la compra no puede superar $${mx(MAX_PURCHASE_TOTAL)}.`,
  );

export const purchaseListSchema = z.object({
  ...paginationFields,
  status: z.enum(['draft', 'received']).optional(),
});

export const createPurchaseSchema = z.object({
  supplierId: z.string().uuid().optional(),
  supplierName: z.string().trim().max(120).optional(),
  notes: z.string().max(1000).optional(),
  items: purchaseItemsSchema,
});

export const updatePurchaseSchema = z.object({
  supplierId: z.string().uuid().optional(),
  notes: z.string().max(1000).optional(),
  items: purchaseItemsSchema.optional(),
});
