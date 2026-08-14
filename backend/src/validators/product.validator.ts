import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  price: z.number().positive('El precio debe ser un número positivo.'),
  cost: z.number().nonnegative('El costo debe ser un número positivo o cero.'),
  categoryId: z.string().uuid('El ID de la categoría no es válido.').optional().nullable(),
  sku: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url('La URL de la imagen no es válida.').optional().nullable(),
});

export const updateProductSchema = createProductSchema.partial().extend({
    isActive: z.boolean().optional(),
    displayOrder: z.number().int().optional(),
});

export const filterQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  category: z.string().uuid().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
});