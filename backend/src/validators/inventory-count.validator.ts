import { z } from 'zod';

export const inventoryCountValidator = {
  addItem: z.object({
    ingredientId: z.string().uuid('ID de ingrediente inválido'),
    countedQuantity: z
      .number()
      .nonnegative('La cantidad debe ser mayor o igual a 0'),
    notes: z.string().optional().nullable(),
  }),
};
