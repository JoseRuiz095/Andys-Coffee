import { z } from 'zod';
import { catalogIdSchema } from './common.validator';

/** A group of products shown together in the POS (e.g. "Latte" with its flavors). */
export const createProductFamilySchema = z.strictObject({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.').max(60),
  categoryId: catalogIdSchema.nullable().optional(),
  displayOrder: z.number().int().nonnegative().max(9999).optional(),
});

export const updateProductFamilySchema = createProductFamilySchema.partial()
  .extend({ isActive: z.boolean().optional() })
  .refine((data) => Object.keys(data).length > 0, { message: 'Debes indicar al menos un campo a editar.' });
