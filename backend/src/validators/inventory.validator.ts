import { z } from 'zod';

export const inventoryListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  search: z.string().optional(),
  status: z.enum(['all', 'normal', 'low_stock', 'out_of_stock']).default('all'),
  isActive: z.coerce.boolean().optional().default(true),
});

export const inventoryMovementsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  ingredientId: z.string().uuid().optional(),
  type: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional(),
});

export const ingredientCreateSchema = z.object({
  name: z.string().min(1).max(255),
  sku: z.string().optional(),
  unitId: z.string().uuid(),
  minimumStock: z.string().or(z.number()).transform((v) => String(v)).optional(),
});

export const ingredientUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  sku: z.string().optional(),
  minimumStock: z.string().or(z.number()).transform((v) => String(v)).optional(),
});

export const inventoryEntrySchema = z.object({
  supplierId: z.string().uuid().optional(),
  invoiceNumber: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      ingredientId: z.string().uuid(),
      quantity: z.string().or(z.number()).transform((v) => String(v)),
      unitCost: z.string().or(z.number()).transform((v) => String(v)),
    }),
  ).min(1),
});

export const inventoryExitReasons = ['waste', 'sample', 'internal_consumption', 'donation', 'other'] as const;

export const inventoryExitSchema = z.object({
  ingredientId: z.string().uuid(),
  quantity: z.string().or(z.number()).transform((v) => String(v)),
  reason: z.enum(inventoryExitReasons),
  notes: z.string().max(500).optional(),
});
