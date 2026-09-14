import { z } from 'zod';

export const createPurchaseSchema = z.object({
  supplierId: z.string().uuid().optional(),
  supplierName: z.string().optional(),
  invoiceNumber: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      ingredientId: z.string().uuid(),
      quantity: z.string().or(z.number()).transform((v) => String(v)),
      unitCost: z.string().or(z.number()).transform((v) => String(v)),
    })
  ).min(1, 'La compra debe tener al menos 1 item'),
  tax: z.string().or(z.number()).transform((v) => String(v)).optional(),
});

export const updatePurchaseSchema = z.object({
  supplierId: z.string().uuid().optional(),
  invoiceNumber: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      ingredientId: z.string().uuid(),
      quantity: z.string().or(z.number()).transform((v) => String(v)),
      unitCost: z.string().or(z.number()).transform((v) => String(v)),
    })
  ).optional(),
});
