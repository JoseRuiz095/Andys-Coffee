import { z } from 'zod';
import { normalizedSearchSchema, paginationFields } from './pagination.validator';
import { catalogIdSchema, productRecipeSchema } from './recipe.validator';

/** Attribute of a product inside its family (e.g. Salsa = Roja). Names can't repeat. */
const variantOptionsSchema = z
  .array(z.strictObject({
    name: z.string().trim().min(1).max(40),
    value: z.string().trim().min(1).max(60),
  }))
  .max(5)
  .refine((options) => new Set(options.map(({ name }) => name.toLowerCase())).size === options.length, {
    message: 'Hay opciones repetidas.',
  });

export const createProductSchema = z.object({
  // V1 (2026-11-14): finite, bounded values — Infinity or 1e13 overflowed Decimal(12,2) as a 500.
  name: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres.').max(120),
  price: z.coerce.number().finite().positive('El precio debe ser un número positivo.').max(1_000_000, 'El precio es demasiado alto.'),
  cost: z.coerce.number().finite().nonnegative('El costo debe ser un número positivo o cero.').max(1_000_000, 'El costo es demasiado alto.'),
  categoryId: z.string().uuid('El ID de la categoría no es válido.').optional().nullable(),
  temperature: z.enum(['HOT', 'COLD', 'BOTH']).optional().nullable(),
  jumboPrice: z.coerce.number().finite().positive('El precio Jumbo debe ser mayor a cero.').max(1_000_000, 'El precio es demasiado alto.').optional().nullable(),
  sku: z.string().trim().max(60).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  displayOrder: z.coerce.number().int().nonnegative().optional(),
  // false = sold without consuming ingredients ("No controla inventario"): no recipe required.
  tracksInventory: z.boolean().optional(),
  familyId: catalogIdSchema.nullable().optional(),
  variantLabel: z.string().trim().max(60).nullable().optional(),
  // Each list replaces the stored one when sent; omitted = unchanged.
  options: variantOptionsSchema.optional(),
  extraIds: z.array(catalogIdSchema).max(50).refine((ids) => new Set(ids).size === ids.length, {
    message: 'Hay extras repetidos.',
  }).optional(),
  // Ingredients and quantities per size (requires inventory.manage_recipes).
  recipe: productRecipeSchema.optional(),
});

export const updateProductSchema = createProductSchema.partial().extend({
    isActive: z.boolean().optional(),
});

export { setActiveSchema } from './common.validator';

export const filterQuerySchema = z.strictObject({
  ...paginationFields,
  category: z.string().uuid().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  search: normalizedSearchSchema.optional(),
});
