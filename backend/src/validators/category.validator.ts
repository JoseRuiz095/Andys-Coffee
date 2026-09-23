import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido.'),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url('La URL de la imagen no es válida.').optional().nullable(),
  displayOrder: z.coerce.number().int().nonnegative().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export { setActiveSchema } from './common.validator';
