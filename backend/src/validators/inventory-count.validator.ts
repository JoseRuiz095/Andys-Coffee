import { z } from 'zod';
import { calendarDateSchema, catalogIdSchema } from './common.validator';
import { paginationFields } from './pagination.validator';

export const inventoryCountValidator = {
  addItem: z.object({
    ingredientId: catalogIdSchema,
    // Bounded so it fits Decimal(14,4); without max, 1e20 reached Prisma and answered 500.
    countedQuantity: z
      .number()
      .finite()
      .nonnegative('La cantidad debe ser mayor o igual a 0')
      .max(1_000_000_000, 'La cantidad no puede superar 1,000,000,000.'),
    notes: z.string().max(500).optional().nullable(),
  }),
};

export const inventoryCountListSchema = z.object({
  ...paginationFields,
  status: z.enum(['draft', 'completed', 'applied']).optional(),
  date: calendarDateSchema.optional(),
});
