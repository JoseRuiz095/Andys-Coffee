import { z } from 'zod';

export { setActiveSchema } from './common.validator';

const money = (label: string) => z.number().finite().nonnegative(`${label} no puede ser negativo.`).max(99999.99);

/** An extra sold on top of a product (e.g. "Shot de espresso", "Leche de avena"). */
export const createExtraSchema = z.strictObject({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.').max(80),
  description: z.string().trim().max(300).optional().nullable(),
  price: money('El precio'),
  cost: money('El costo'),
});

export const updateExtraSchema = createExtraSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: 'Debes indicar al menos un campo a editar.',
});

/** Replaces the extras offered with a product. */
export const setProductExtrasSchema = z.strictObject({
  extraIds: z.array(z.string().uuid()).max(50).refine((ids) => new Set(ids).size === ids.length, {
    message: 'Hay extras repetidos.',
  }),
});
