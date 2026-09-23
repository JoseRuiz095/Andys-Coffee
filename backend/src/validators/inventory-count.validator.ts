import { z } from 'zod';
import { calendarDateSchema } from './common.validator';
import { paginationFields } from './pagination.validator';

export const inventoryCountValidator = {
  addItem: z.object({
    ingredientId: z.string().uuid('ID de ingrediente inválido'),
    countedQuantity: z
      .number()
      .nonnegative('La cantidad debe ser mayor o igual a 0'),
    notes: z.string().max(500).optional().nullable(),
  }),
};

export const inventoryCountListSchema = z.object({
  ...paginationFields,
  status: z.enum(['draft', 'completed', 'applied']).optional(),
  date: calendarDateSchema.optional(),
});
