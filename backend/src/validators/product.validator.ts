import { z } from 'zod';
import { normalizedSearchSchema, paginationFields } from './pagination.validator';

export const createProductSchema = z.object({
  name: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  price: z.coerce.number().positive('El precio debe ser un número positivo.'),
  cost: z.coerce.number().nonnegative('El costo debe ser un número positivo o cero.'),
  categoryId: z.string().uuid('El ID de la categoría no es válido.').optional().nullable(),
  sku: z.string().trim().optional().nullable(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url('La URL de la imagen no es válida.').optional().nullable(),
  displayOrder: z.coerce.number().int().nonnegative().optional(),
});

export const updateProductSchema = createProductSchema.partial().extend({
    isActive: z.boolean().optional(),
});

export const setActiveSchema = z.object({
  isActive: z.boolean(),
});

export const filterQuerySchema = z.strictObject({
  ...paginationFields,
  category: z.string().uuid().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  search: normalizedSearchSchema.optional(),
});