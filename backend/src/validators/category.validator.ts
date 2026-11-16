import { z } from 'zod';
import { paginationFields } from './pagination.validator';
import { queryBoolean } from './common.validator';

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido.'),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url('La URL de la imagen no es válida.').optional().nullable(),
  displayOrder: z.coerce.number().int().nonnegative().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export { setActiveSchema } from './common.validator';

/** GET /categories (public): bounded pagination (R3: a negative page answered 500). */
export const categoryListQuerySchema = z.object({
  page: paginationFields.page,
  limit: z.coerce.number().int().min(1).max(100).default(100),
  includeInactive: queryBoolean.optional(),
});
