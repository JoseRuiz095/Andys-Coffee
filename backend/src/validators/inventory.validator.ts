import { z } from 'zod';
import { queryBoolean } from './common.validator';

export const inventoryListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  // Higher cap than other list endpoints: the exits/physical-count UIs request
  // limit=1000 to populate a full ingredient-selection dropdown in one call.
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  search: z.string().optional(),
  status: z.enum(['all', 'normal', 'low_stock', 'out_of_stock']).default('all'),
  isActive: queryBoolean.default(true),
  // Only the ingredients of this product's recipe (any size or temperature).
  productId: z.string().uuid().optional(),
});

export const inventoryMovementsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  ingredientId: z.string().uuid().optional(),
  type: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional(),
  orderId: z.string().trim().min(1).max(64).optional(),
});

const stockAmount = z.string().or(z.number()).transform((v) => String(v))
  .refine((v) => v.trim() !== '' && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 1_000_000_000, 'Debe ser un número entre 0 y 1,000,000,000.');

export const ingredientCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  // Optional: the server assigns INS-### when it is missing.
  sku: z.string().trim().max(50).optional(),
  unitId: z.string().uuid(),
  minimumStock: stockAmount.optional(),
  // Restock target; null/omitted = 2 × minimumStock.
  maximumStock: stockAmount.nullable().optional(),
});

export const ingredientUpdateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  sku: z.string().trim().max(50).optional(),
  minimumStock: stockAmount.optional(),
  maximumStock: stockAmount.nullable().optional(),
});

/** GET /inventory/replenishment: consumption window in days. */
export const replenishmentQuerySchema = z.strictObject({
  days: z.coerce.number().int().min(1).max(90).default(14),
  // Only this product's recipe ingredients, including those that don't cover one unit.
  productId: z.string().uuid().optional(),
});

/** PATCH /inventory/settings: inventory switches (at least one). */
export const inventorySettingsSchema = z.strictObject({
  consumeOnSale: z.boolean().optional(),
  lowStockNotify: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'Indica al menos un ajuste.' });

export const inventoryExitReasons = ['waste', 'damaged', 'expired', 'sample', 'internal_consumption', 'donation', 'other'] as const;

export const inventoryExitSchema = z.object({
  ingredientId: z.string().uuid(),
  // V2 (2026-11-14): a non-numeric quantity used to reach Prisma.Decimal and answer 500.
  quantity: z.string().or(z.number()).transform((v) => String(v))
    .refine((v) => v.trim() !== '' && Number.isFinite(Number(v)) && Number(v) > 0 && Number(v) <= 100_000, 'La cantidad debe ser un número mayor a 0.'),
  reason: z.enum(inventoryExitReasons),
  notes: z.string().max(500).optional(),
});
