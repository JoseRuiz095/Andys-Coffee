import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(3),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
});

export const updateCategorySchema = createCategorySchema.partial().extend({
    isActive: z.boolean().optional(),
    displayOrder: z.number().int().optional(),
});